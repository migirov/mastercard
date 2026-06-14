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
import { AccountValidationRequestDto } from './dto/account-validation-request.dto';
import { AddressValidationRequestDto } from './dto/address-validation-request.dto';
import { BankLookupRequestDto } from './dto/bank-lookup-request.dto';
import { ConfirmationRequestDto } from './dto/confirmation-request.dto';
import { IbanGenerationRequestDto } from './dto/iban-generation-request.dto';
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
    // У Address Validation СВОЯ база (без /crossborder и без partner-id в пути).
    return this.callRef(
      creds,
      `/send/address-validation-service/addresses/validations`,
      body,
      'validateAddress',
    );
  }

  /**
   * Валидация счёта получателя ДО платежа (POST, MC Account Validation API).
   * accountUri = { type: IBAN|PAN|BAN, value }. Путь — с partner-id (как quote).
   * На sandbox проверяемо для IBAN/CES-кейсов; ASV (requestType=ASV) в sandbox нет.
   */
  async validateAccount(tenantId: string, body: AccountValidationRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.callRef(
      creds,
      `/send/partners/${this.partner(creds)}/crossborder/accounts/validations`,
      body,
      'validateAccount',
    );
  }

  /** Поиск реквизитов банка получателя (POST, MC Bank Information Lookup API). */
  async lookupBank(tenantId: string, body: BankLookupRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.callRef(
      creds,
      `/send/partners/${this.partner(creds)}/crossborder/banks/details`,
      body,
      'lookupBank',
    );
  }

  /** Генерация IBAN из реквизитов счёта (POST, MC IBAN Generation API). */
  async generateIban(tenantId: string, body: IbanGenerationRequestDto) {
    const creds = await this.resolveActive(tenantId);
    return this.callRef(
      creds,
      `/send/partners/${this.partner(creds)}/crossborder/accounts/generate-ibans`,
      body,
      'generateIban',
    );
  }

  // --- Cash Pickup Locations (GET-каталоги; partner-id в ЗАГОЛОВКЕ, не в пути) ---

  /** Список стран с выдачей наличных (GET, фильтр по cash_pickup_type). */
  async cashPickupCountries(tenantId: string, cashPickupType?: string) {
    const creds = await this.resolveActive(tenantId);
    return this.callCatalog(
      creds,
      `/crossborder/cash-pickup/countries${this.qs({ cash_pickup_type: cashPickupType })}`,
      'cashPickupCountries',
    );
  }

  /** Города с выдачей наличных (GET, Directed). */
  async cashPickupCities(
    tenantId: string,
    q: { country?: string; currency?: string; offset?: string; limit?: string },
  ) {
    const creds = await this.resolveActive(tenantId);
    return this.callCatalog(
      creds,
      `/crossborder/cash-pickup/cities${this.qs(q)}`,
      'cashPickupCities',
    );
  }

  /** Receiving Service Providers (GET). */
  async cashPickupProviders(
    tenantId: string,
    q: {
      country?: string;
      currency?: string;
      cash_pickup_type?: string;
      offset?: string;
      limit?: string;
    },
  ) {
    const creds = await this.resolveActive(tenantId);
    return this.callCatalog(
      creds,
      `/crossborder/cash-pickup/providers${this.qs(q)}`,
      'cashPickupProviders',
    );
  }

  /** Точки выдачи конкретного провайдера (GET). */
  async cashPickupBranches(
    tenantId: string,
    q: {
      provider_id?: string;
      state?: string;
      city?: string;
      offset?: string;
      limit?: string;
    },
  ) {
    const creds = await this.resolveActive(tenantId);
    return this.callCatalog(
      creds,
      `/crossborder/cash-pickup/branches${this.qs(q)}`,
      'cashPickupBranches',
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
   * Значение HTTP-заголовка без CR/LF — defense-in-depth против header-injection,
   * НЕ зависящая от валидатора источника. partnerId уже safePartnerId-валиден (нет
   * CRLF), но safePartnerId — регэксп для URL-ПУТИ; привязываем безопасность
   * заголовка к самому месту использования: если его когда-то ослабят, заголовки
   * не пострадают.
   */
  private headerSafe(v: string): string {
    return v.replace(/[\r\n]/g, '');
  }

  /**
   * Доп. заголовки, которые MC требует у validation/lookup-сервисов (Address /
   * Account / Bank): X-Mc-Correlation-Id — уникальный per-request trace;
   * Partner-Ref-Id — «reference ID of the business partner». Берём СЫРОЙ partnerId
   * (НЕ partner()=encodeURIComponent — это кодировщик URL-ПУТИ; в заголовке нужно
   * сырое значение, иначе partnerId с `+`/`&`/`=` исказился бы), но через headerSafe.
   * (Семантику Partner-Ref-Id — id партнёра vs per-request ref — уточнить у MC.)
   */
  private mcRefHeaders(creds: McCredentials): Record<string, string> {
    return {
      'X-Mc-Correlation-Id': randomUUID(),
      'Partner-Ref-Id': this.headerSafe(creds.partnerId),
    };
  }

  /**
   * POST в MC validation/lookup-сервис (Address/Account/Bank/IBAN): единое
   * построение запроса с ref-заголовками (mcRefHeaders) + разворачивание ответа
   * через call(). path передаётся готовым — у сервисов разные базы (Address —
   * своя, прочие — /send/partners/.../crossborder).
   */
  private callRef(
    creds: McCredentials,
    path: string,
    body: unknown,
    ctx: string,
  ): Promise<unknown> {
    return this.call(
      creds,
      { method: 'POST', path, body, headers: this.mcRefHeaders(creds) },
      ctx,
    );
  }

  /**
   * Query-строка из заданных параметров: только непустые, значения URL-кодируются
   * (анти query-injection — значения уходят в URL запроса к MC, который потом
   * подписывается OAuth1). Возвращает `?k=v&...` или пустую строку.
   */
  private qs(params: Record<string, string | undefined>): string {
    const pairs = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
  }

  /**
   * GET в MC Cash Pickup-каталог: partner-id передаётся ЗАГОЛОВКОМ (не в пути).
   * Сырой partnerId (в заголовке не URL-кодируем), но через headerSafe (анти-CRLF).
   */
  private callCatalog(
    creds: McCredentials,
    path: string,
    ctx: string,
  ): Promise<unknown> {
    return this.call(
      creds,
      {
        method: 'GET',
        path,
        headers: { 'partner-id': this.headerSafe(creds.partnerId) },
      },
      ctx,
    );
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
