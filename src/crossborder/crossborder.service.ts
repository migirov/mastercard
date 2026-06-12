import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { sha256hex } from '../common/crypto.util';
import { UpstreamHttpException } from '../common/upstream.exception';
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
import { AddressValidationRequestDto } from './dto/address-validation-request.dto';
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
    // Idempotency-Key уже провалидирован на границе (IdempotencyKeyPipe: длина
    // ≤128 + безопасный charset для kv_store.key). Здесь — только бизнес-логика.
    // Резолвим credentials (gating + возможный медленный SecretStore) ДО захвата
    // замка идемпотентности: producer внутри замка должен быть ограничен только
    // 30-сек таймаутом MC (≪ LOCK_TTL 120с), иначе медленный Vault может растянуть
    // producer за TTL → второй под перезахватит замок → двойной POST.
    const creds = await this.resolveActive(tenantId);
    // Идемпотентность: тот же Idempotency-Key → тот же результат, без повторного
    // вызова MC (защита от двойных списаний при ретрае). Fingerprint тела: тот же
    // ключ с ДРУГИМ телом → 422 (не молчаливый возврат результата первого платежа).
    const fingerprint = sha256hex(JSON.stringify(body));
    return this.idempotency.run(
      tenantId,
      idempotencyKey,
      () =>
        this.call(
          creds,
          {
            method: 'POST',
            path: `/send/v1/partners/${this.partner(creds)}/crossborder/payment`,
            body,
          },
          'createPayment',
        ),
      fingerprint,
    );
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

  /**
   * Валидация адреса получателя (POST, до платежа). У MC СВОЯ база
   * (`/send/address-validation-service/...`) — без `/crossborder` и без partner-id
   * в пути; OAuth1-подпись всё равно ставится по creds тенанта в интерцепторе.
   */
  async validateAddress(tenantId: string, body: AddressValidationRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.call(
      creds,
      {
        method: 'POST',
        path: `/send/address-validation-service/addresses/validations`,
        body,
        // Этот сервис MC требует доп. заголовки (дока api-ref Address Validation):
        // X-Mc-Correlation-Id — уникальный per-request trace; Partner-Ref-Id —
        // «reference ID of the business partner» (берём partnerId как идентичность
        // партнёра; per-request уникальность уже даёт correlation-id). Семантику
        // Partner-Ref-Id уточнить у MC при интеграции (открытый вопрос, как C1/E1) —
        // проверить на sandbox нельзя: сервис требует ШИФРОВАНИЯ payload, а FLE в
        // sandbox выключен (MC отвергает plain → 062000 INVALID_INPUT_FORMAT).
        headers: {
          'X-Mc-Correlation-Id': randomUUID(),
          'Partner-Ref-Id': this.partner(creds),
        },
      },
      'validateAddress',
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
    if (
      FORWARDABLE_STATUSES.has(res.status) &&
      res.data &&
      typeof res.data === 'object'
    ) {
      // Тело уже расшифровано интерцептором (для plain — без изменений).
      // Пробрасываем ТОЛЬКО структурированный JSON-ответ MC (объект). Не-объект
      // (HTML/строка от edge/WAF на 429 и т.п.) скрываем как 502 ниже — иначе
      // в `upstream` могла бы утечь HTML-страница с внутренними ссылками.
      // UpstreamHttpException → фильтр вложит тело MC под `upstream`, сохранив
      // единый контракт ошибки (а не подменив его схемой MC).
      throw new UpstreamHttpException(res.data, res.status);
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
