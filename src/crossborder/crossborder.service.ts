import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CredentialsService } from '../credentials/credentials.service';
import { McCredentials } from '../credentials/credentials.types';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  McRequest,
  McResponse,
  MastercardClient,
} from '../mastercard/mastercard-client.service';
import { TenantRegistry } from '../tenants/tenant.registry';
import { effectiveStatus, isActive } from '../tenants/tenant.types';
import { ConfirmationRequestDto } from './dto/confirmation-request.dto';
import { PaymentRequestDto } from './dto/payment-request.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';

/** Бизнес/клиентские статусы Mastercard, которые осмысленно пробрасывать мерчанту. */
const FORWARDABLE_STATUSES = new Set([400, 404, 409, 422, 429]);

/**
 * Бизнес-операции Cross-Border в контексте конкретного мерчанта.
 * Каждая операция: проверяем доступ тенанта → резолвим credentials →
 * подписываем и вызываем Mastercard → разворачиваем ответ.
 */
@Injectable()
export class CrossBorderService {
  private readonly logger = new Logger(CrossBorderService.name);

  constructor(
    private readonly registry: TenantRegistry,
    private readonly credentials: CredentialsService,
    private readonly client: MastercardClient,
    private readonly idempotency: IdempotencyService,
  ) {}

  /** Список счетов и балансов (GET, без шифрования). */
  async getBalances(tenantId: string) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'GET',
        path: `/send/partners/${this.partner(creds)}/crossborder/accounts?include_balance=true`,
      },
      'getBalances',
    );
  }

  /** Доступные FX-курсы (GET). */
  async getRates(tenantId: string) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'GET',
        path: `/send/v1/partners/${this.partner(creds)}/crossborder/rates`,
      },
      'getRates',
    );
  }

  /**
   * Запрос котировки (POST). Шифрование тела (MTF/Prod) и подпись — прозрачно
   * в axios-интерцепторе `MastercardClient`; здесь отдаём чистый объект.
   */
  async createQuote(tenantId: string, body: QuoteRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'POST',
        path: `/send/v1/partners/${this.partner(creds)}/crossborder/quotes`,
        body,
      },
      'createQuote',
    );
  }

  /**
   * Инициировать платёж (POST). Идемпотентность — на стороне MC по
   * transaction_reference (тот же ref = та же транзакция). Тело шифруется в
   * MTF/Prod так же, как quote.
   */
  async createPayment(
    tenantId: string,
    body: PaymentRequestDto,
    idempotencyKey?: string,
  ) {
    // Валидируем Idempotency-Key ДО использования как ключа KV: иначе длинный
    // ключ переполнит kv_store.key (varchar 256) → ошибка БД → 500. Ограничиваем
    // длину и безопасный charset (UUID/токены укладываются).
    if (
      idempotencyKey !== undefined &&
      (idempotencyKey.length > 128 || !/^[\w.\-:]+$/.test(idempotencyKey))
    ) {
      throw new BadRequestException(
        'Idempotency-Key: up to 128 chars from [A-Za-z0-9._-:]',
      );
    }
    // Идемпотентность: тот же Idempotency-Key → тот же результат, без повторного
    // вызова MC (защита от двойных списаний при ретрае).
    return this.idempotency.run(tenantId, idempotencyKey, async () => {
      const creds = await this.resolveActive(tenantId);
      return this.call(
        creds,
        {
          method: 'POST',
          path: `/send/v1/partners/${this.partner(creds)}/crossborder/payment`,
          body,
        },
        'createPayment',
      );
    });
  }

  /** Статус платежа по transaction id (GET). id уже проверен SafeIdPipe в контроллере. */
  async getPayment(tenantId: string, paymentId: string) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'GET',
        path: `/send/v1/partners/${this.partner(creds)}/crossborder/${encodeURIComponent(paymentId)}`,
      },
      'getPayment',
    );
  }

  /** Статус платежа по transaction reference (GET ?ref=). ref проверен SafeIdPipe. */
  async getPaymentByRef(tenantId: string, ref: string) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'GET',
        path: `/send/v1/partners/${this.partner(creds)}/crossborder?ref=${encodeURIComponent(ref)}`,
      },
      'getPaymentByRef',
    );
  }

  /** Отмена платежа (POST). id уже проверен SafeIdPipe в контроллере. */
  async cancelPayment(tenantId: string, paymentId: string) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'POST',
        path: `/send/v1/partners/${this.partner(creds)}/crossborder/${encodeURIComponent(paymentId)}/cancel`,
      },
      'cancelPayment',
    );
  }

  /** Подтверждение котировки (POST). Шифрование — в интерцепторе. */
  async confirmQuote(tenantId: string, body: ConfirmationRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'POST',
        path: `/send/partners/${this.partner(creds)}/crossborder/quotes/confirmations`,
        body,
      },
      'confirmQuote',
    );
  }

  // --- инфраструктура ---

  /** partner-id, безопасно подставляемый в путь (защита от path-injection в OWN). */
  private partner(creds: McCredentials): string {
    return encodeURIComponent(creds.partnerId);
  }

  /**
   * Вызывает Mastercard и разворачивает ответ:
   *   2xx                       → данные;
   *   бизнес-4xx (400/404/...)  → проброс статуса и тела мерчанту;
   *   401/403/5xx/прочее        → 502, тело наружу не отдаём (может быть HTML
   *                               с внутренними ссылками), детали — в лог;
   *   сетевая ошибка            → 502.
   */
  private async call<T>(
    creds: McCredentials,
    req: McRequest,
    ctx: string,
  ): Promise<T> {
    let res: McResponse<T>;
    try {
      // Расшифровка ответа — в response-интерцепторе MastercardClient; если она
      // упадёт, ошибка прилетит сюда и превратится в 502 ниже.
      res = await this.client.request<T>(creds, req);
    } catch (e) {
      this.logger.error(
        `Mastercard ${ctx}: ошибка вызова/расшифровки — ${(e as Error).message}`,
      );
      throw new BadGatewayException('Error contacting Mastercard');
    }

    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    if (FORWARDABLE_STATUSES.has(res.status)) {
      // Тело уже расшифровано интерцептором (для plain — без изменений).
      throw new HttpException(res.data as Record<string, unknown>, res.status);
    }
    // 401/403 — это проблема НАШИХ credentials, а не мерчанта; не вводим его в
    // заблуждение и не палим, что ключи невалидны. 5xx — тоже наружу не отдаём.
    this.logger.error(`Mastercard ${ctx}: upstream HTTP ${res.status}`);
    throw new BadGatewayException('Error contacting Mastercard');
  }

  /**
   * Резолвит credentials мерчанта, предварительно проверив, что он ACTIVE.
   * Gating: транзакции запрещены, пока нет двойного одобрения.
   */
  private async resolveActive(tenantId: string): Promise<McCredentials> {
    const tenant = await this.registry.get(tenantId);
    if (!isActive(tenant)) {
      throw new ForbiddenException(
        `Tenant '${tenantId}' is not active (status ${effectiveStatus(tenant)})`,
      );
    }
    return this.credentials.resolve(tenant);
  }
}
