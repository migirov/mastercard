import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { sha256hex } from '../common/crypto.util';
import { stripCrlf } from '../common/sanitize.util';
import { UpstreamHttpException } from '../common/upstream.exception';
import { CredentialsService } from '../credentials/credentials.service';
import { McCredentials } from '../credentials/credentials.types';
import { PaymentIdempotencyStore } from './payment-idempotency.store';
import {
  McRequest,
  McResponse,
  MastercardClient,
} from '../mastercard/mastercard-client.service';
import { TenantRegistry } from '../tenants/tenant.registry';
import {
  CredentialMode,
  effectiveStatus,
  isActive,
  Tenant,
} from '../tenants/tenant.types';
import { AccountValidationRequestDto } from './dto/account-validation-request.dto';
import { AddressValidationRequestDto } from './dto/address-validation-request.dto';
import { BankLookupRequestDto } from './dto/bank-lookup-request.dto';
import { ConfirmationRequestDto } from './dto/confirmation-request.dto';
import { IbanGenerationRequestDto } from './dto/iban-generation-request.dto';
import {
  mcPath,
  CashPickupCitiesQuery,
  CashPickupProvidersQuery,
  CashPickupBranchesQuery,
  EndpointGuideQuery,
} from './mc-paths';
import { PaymentRequestDto } from './dto/payment-request.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { RfiDocumentUploadRequestDto } from './dto/rfi-document-upload-request.dto';
import { RfiUpdateRequestDto } from './dto/rfi-update-request.dto';
import { StatusEventViewDto } from './dto/status-event-view.dto';
import { TransactionStatusStore } from '../webhooks/transaction-status.store';

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
    private readonly idempotency: PaymentIdempotencyStore,
    private readonly statusEvents: TransactionStatusStore,
  ) {}

  /** Список счетов и балансов (GET, без шифрования). */
  async getBalances(tenantId: string) {
    return this.run(tenantId, 'getBalances', (c) => ({
      method: 'GET',
      path: mcPath.balances(this.partner(c)),
    }));
  }

  /**
   * Carded / FX Rate Pull (GET, БЕЗ тела): FX-курсы для сконфигурированных
   * коридоров — основной механизм получения курсов до инициации платежа.
   * По доке MC это операция `getFxRates`: GET, «No Request body» (поэтому НЕ
   * POST — прежний POST-вариант убран как несуществующий у MC). Sandbox для
   * Carded Rate НЕДОСТУПЕН (по доке MC) → проверяется только проводка шлюза.
   * Push-вариант (Carded Rate Push) — вебхук на /webhooks/mastercard.
   */
  async getRates(tenantId: string) {
    return this.run(tenantId, 'getRates', (c) => ({
      method: 'GET',
      path: mcPath.rates(this.partner(c)),
    }));
  }

  /**
   * Запрос котировки (POST). Шифрование тела (MTF/Prod) и подпись — прозрачно
   * в axios-интерцепторе `MastercardClient`; здесь отдаём чистый объект.
   */
  async createQuote(tenantId: string, body: QuoteRequestDto) {
    return this.run(tenantId, 'createQuote', (c) => ({
      method: 'POST',
      path: mcPath.quotes(this.partner(c)),
      body,
    }));
  }

  /**
   * Initiate a payment (POST). Idempotency is keyed on `transaction_reference` (same ref =
   * same transaction), backed by Postgres. The body is encrypted in MTF/Prod, same as quote.
   */
  async createPayment(tenantId: string, body: PaymentRequestDto) {
    // Resolve credentials (gating + a possibly slow SecretStore) BEFORE claiming the
    // idempotency lock: the producer inside the lock must be bounded only by MC's 30s
    // timeout (≪ LOCK_TTL 120s), otherwise a slow Vault could stretch the producer past the
    // TTL → another pod re-claims the lock → a double POST.
    const creds = await this.resolveActive(tenantId);
    // Idempotency by `transaction_reference` — the payment's business key and source of
    // truth: it's mandatory at MC and MC dedups on it. A retry with the same
    // `transaction_reference` → the same result WITHOUT re-calling MC (double-charge
    // protection); the state lives in Postgres (`payment_idempotency`), not in KV. The key
    // is hashed (ref is an arbitrary client string → bounded for the idemKey column). Body
    // fingerprint: same ref with a DIFFERENT body → 422 (protects against payment swap).
    // No ref → MC rejects the payment anyway (field is mandatory) → no idempotency.
    const ref = body?.paymentrequest?.transaction_reference;
    const idemKey = ref ? `txref:${sha256hex(ref)}` : undefined;
    const fingerprint = sha256hex(JSON.stringify(body));
    return this.idempotency.run(
      tenantId,
      idemKey,
      () =>
        this.call(
          creds,
          {
            method: 'POST',
            path: mcPath.payment(this.partner(creds)),
            body,
          },
          'createPayment',
        ),
      fingerprint,
    );
  }

  /** Статус платежа по transaction id (GET). id уже проверен SafeIdPipe в контроллере. */
  async getPayment(tenantId: string, paymentId: string) {
    return this.run(tenantId, 'getPayment', (c) => ({
      method: 'GET',
      path: mcPath.paymentById(this.partner(c), paymentId),
    }));
  }

  /** Статус платежа по transaction reference (GET ?ref=). ref проверен SafeIdPipe. */
  async getPaymentByRef(tenantId: string, ref: string) {
    return this.run(tenantId, 'getPaymentByRef', (c) => ({
      method: 'GET',
      path: mcPath.paymentByRef(this.partner(c), ref),
    }));
  }

  /** Отмена платежа (POST). id уже проверен SafeIdPipe в контроллере. */
  async cancelPayment(tenantId: string, paymentId: string) {
    return this.run(tenantId, 'cancelPayment', (c) => ({
      method: 'POST',
      path: mcPath.cancelPayment(this.partner(c), paymentId),
    }));
  }

  /**
   * Валидация адреса получателя (POST, до платежа). У MC СВОЯ база
   * (`/send/address-validation-service/...`) — без `/crossborder` и без partner-id
   * в пути; OAuth1-подпись всё равно ставится по creds тенанта в интерцепторе.
   */
  async validateAddress(tenantId: string, body: AddressValidationRequestDto) {
    // У Address Validation СВОЯ база (без /crossborder и без partner-id в пути).
    return this.run(tenantId, 'validateAddress', (c) => ({
      method: 'POST',
      path: mcPath.addressValidations(),
      body,
      headers: this.mcRefHeaders(c),
    }));
  }

  /**
   * Валидация счёта получателя ДО платежа (POST, MC Account Validation API).
   * accountUri = { type: IBAN|PAN|BAN, value }. Путь — с partner-id (как quote).
   * На sandbox проверяемо для IBAN/CES-кейсов; ASV (requestType=ASV) в sandbox нет.
   */
  async validateAccount(tenantId: string, body: AccountValidationRequestDto) {
    return this.run(tenantId, 'validateAccount', (c) => ({
      method: 'POST',
      path: mcPath.accountValidations(this.partner(c)),
      body,
      headers: this.mcRefHeaders(c),
    }));
  }

  /** Поиск реквизитов банка получателя (POST, MC Bank Information Lookup API). */
  async lookupBank(tenantId: string, body: BankLookupRequestDto) {
    return this.run(tenantId, 'lookupBank', (c) => ({
      method: 'POST',
      path: mcPath.bankDetails(this.partner(c)),
      body,
      headers: this.mcRefHeaders(c),
    }));
  }

  /** Генерация IBAN из реквизитов счёта (POST, MC IBAN Generation API). */
  async generateIban(tenantId: string, body: IbanGenerationRequestDto) {
    return this.run(tenantId, 'generateIban', (c) => ({
      method: 'POST',
      path: mcPath.generateIbans(this.partner(c)),
      body,
      headers: this.mcRefHeaders(c),
    }));
  }

  // --- Cash Pickup Locations (GET-каталоги; partner-id в ЗАГОЛОВКЕ, не в пути) ---

  /** Список стран с выдачей наличных (GET, фильтр по cash_pickup_type). */
  async cashPickupCountries(tenantId: string, cashPickupType?: string) {
    return this.run(tenantId, 'cashPickupCountries', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup(
        'countries',
        this.qs({ cash_pickup_type: cashPickupType }),
      ),
      headers: this.catalogHeaders(c),
    }));
  }

  /** Города с выдачей наличных (GET, Directed). */
  async cashPickupCities(tenantId: string, q: CashPickupCitiesQuery) {
    return this.run(tenantId, 'cashPickupCities', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('cities', this.qs(q)),
      headers: this.catalogHeaders(c),
    }));
  }

  /** Receiving Service Providers (GET). */
  async cashPickupProviders(tenantId: string, q: CashPickupProvidersQuery) {
    return this.run(tenantId, 'cashPickupProviders', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('providers', this.qs(q)),
      headers: this.catalogHeaders(c),
    }));
  }

  /** Точки выдачи конкретного провайдера (GET). */
  async cashPickupBranches(tenantId: string, q: CashPickupBranchesQuery) {
    return this.run(tenantId, 'cashPickupBranches', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('branches', this.qs(q)),
      headers: this.catalogHeaders(c),
    }));
  }

  /**
   * Endpoint Guide (GET): технические/бизнес-требования к полям для конкретного
   * коридора (payment_type + destination_country/currency/payment_instrument).
   * База `/crossborder` (без /send, без partner-id в пути); идентификация —
   * ref-заголовками (X-Mc-Correlation-Id + Partner-Ref-Id), как у validation-
   * сервисов. Тела запроса НЕТ → шифровать нечего → на sandbox работает вживую.
   */
  async endpointGuide(tenantId: string, q: EndpointGuideQuery) {
    return this.run(tenantId, 'endpointGuide', (c) => ({
      method: 'GET',
      path: mcPath.endpointGuide(this.qs(q)),
      headers: this.mcRefHeaders(c),
    }));
  }

  // --- RFI (Request for Information) APIs ---

  /**
   * Получить текущее состояние RFI-запроса (GET). Путь — с partner-id; requestId
   * уже проверен SafeIdPipe в контроллере. Тела/шифрования нет → на sandbox
   * проверяемо (стаб: request-id с префиксом `33…` → статус OPEN).
   */
  async retrieveRfi(tenantId: string, requestId: string) {
    return this.run(tenantId, 'retrieveRfi', (c) => ({
      method: 'GET',
      path: mcPath.rfiRequest(this.partner(c), requestId),
    }));
  }

  /**
   * Отправить ответ Customer'а на RFI-запрос (POST, обязательный шаг ответа).
   * Тело (обёртка updateRequest) шифруется в MTF/Prod интерцептором. requestId
   * проверен SafeIdPipe.
   */
  async updateRfi(
    tenantId: string,
    requestId: string,
    body: RfiUpdateRequestDto,
  ) {
    return this.run(tenantId, 'updateRfi', (c) => ({
      method: 'POST',
      path: mcPath.rfiRequest(this.partner(c), requestId),
      body,
    }));
  }

  /**
   * Загрузить документ (<1 MB) в RFI-систему (POST). MC возвращает documentId,
   * который затем линкуется к запросу через updateRfi. Тело (base64 в обёртке
   * uploadDocumentRequest) шифруется в MTF/Prod интерцептором.
   */
  async uploadRfiDocument(tenantId: string, body: RfiDocumentUploadRequestDto) {
    return this.run(tenantId, 'uploadRfiDocument', (c) => ({
      method: 'POST',
      path: mcPath.rfiDocuments(this.partner(c)),
      body,
    }));
  }

  /**
   * Скачать документ, приложенный к RFI-запросу (GET). documentId проверен
   * SafeIdPipe. Ответ (base64 в обёртке downloadDocumentResponse) расшифровывается
   * интерцептором в MTF/Prod.
   */
  async downloadRfiDocument(tenantId: string, documentId: string) {
    return this.run(tenantId, 'downloadRfiDocument', (c) => ({
      method: 'GET',
      path: mcPath.rfiDocument(this.partner(c), documentId),
    }));
  }

  /** Подтверждение котировки (POST). Шифрование — в интерцепторе. */
  async confirmQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.run(tenantId, 'confirmQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteConfirmations(this.partner(c)),
      body,
    }));
  }

  /**
   * Отмена ПОДТВЕРЖДЁННОЙ котировки (POST). Тело идентично подтверждению
   * (`{ transactionReference, proposalId }`) → переиспользуем ConfirmationRequestDto.
   * До инициации платежа → возврат зарезервированных средств; после — MC отклонит.
   * Шифрование тела (MTF/Prod) — в интерцепторе.
   */
  async cancelConfirmedQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.run(tenantId, 'cancelConfirmedQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteCancellations(this.partner(c)),
      body,
    }));
  }

  /**
   * Просмотр подтверждённой котировки (GET). ref/proposalId уже проверены
   * SafeIdPipe в контроллере. Тела/шифрования запроса нет; ответ расшифровывается
   * интерцептором в MTF/Prod.
   */
  async retrieveConfirmedQuote(
    tenantId: string,
    ref: string,
    proposalId: string,
  ) {
    return this.run(tenantId, 'retrieveConfirmedQuote', (c) => ({
      method: 'GET',
      path: mcPath.retrieveConfirmedQuote(this.partner(c), ref, proposalId),
    }));
  }

  /**
   * Push-статусы по transaction_reference из НАШЕЙ БД (polling-доставка
   * Status Change Push). Локальное чтение, не вызов MC. Изоляция: OWN-тенант
   * видит СТРОГО свои события; общий null-пул отдаём только PLATFORM-тенанту (у
   * OWN событий в пуле не бывает — они атрибутируются по partnerId). ref уже
   * проверен SafeIdPipe в контроллере. `tenant` берём из auth-контекста (mode уже
   * там — без лишнего запроса к реестру).
   */
  async getStatusEvents(
    tenant: Tenant,
    ref: string,
  ): Promise<StatusEventViewDto[]> {
    const includePool = tenant.credentialMode === CredentialMode.PLATFORM;
    const rows = await this.statusEvents.findForTenant(
      tenant.id,
      ref,
      includePool,
    );
    // Явный маппинг (whitelist): не отдаём внутренние id/tenantId наружу.
    return rows.map((r) => ({
      transactionReference: r.transactionReference ?? null,
      eventType: r.eventType ?? null,
      transactionType: r.transactionType ?? null,
      status: r.status ?? null,
      stage: r.stage ?? null,
      receivedAt: r.receivedAt,
      payload: r.payload,
    }));
  }

  // --- инфраструктура ---

  /** partner-id, безопасно подставляемый в путь (защита от path-injection в OWN). */
  private partner(creds: McCredentials): string {
    return encodeURIComponent(creds.partnerId);
  }

  /**
   * Доп. заголовки, которые MC требует у validation/lookup-сервисов (Address /
   * Account / Bank): X-Mc-Correlation-Id — уникальный per-request trace;
   * Partner-Ref-Id — «reference ID of the business partner». Берём СЫРОЙ partnerId
   * (НЕ partner()=encodeURIComponent — это кодировщик URL-ПУТИ; в заголовке нужно
   * сырое значение, иначе partnerId с `+`/`&`/`=` исказился бы), но через stripCrlf.
   * (Семантику Partner-Ref-Id — id партнёра vs per-request ref — уточнить у MC.)
   */
  private mcRefHeaders(creds: McCredentials): Record<string, string> {
    return {
      'X-Mc-Correlation-Id': randomUUID(),
      'Partner-Ref-Id': stripCrlf(creds.partnerId),
    };
  }

  /**
   * Единый раннер операции: gating (resolveActive) → строим McRequest по
   * резолвленным creds → вызываем MC и разворачиваем ответ (call). Публичные
   * методы становятся одной строкой; вся повторяющаяся обвязка (резолв + диспатч)
   * здесь. `build` получает creds, потому что путь часто зависит от partner(creds).
   * Заголовочную стратегию метод выбирает явно на месте: `mcRefHeaders(c)` для
   * validation/guide, `catalogHeaders(c)` для cash-pickup, либо без заголовков.
   */
  private async run<T>(
    tenantId: string,
    ctx: string,
    build: (creds: McCredentials) => McRequest,
  ): Promise<T> {
    const creds = await this.resolveActive(tenantId);
    return this.call<T>(creds, build(creds), ctx);
  }

  /** Заголовки Cash Pickup-каталога: partner-id в ЗАГОЛОВКЕ (сырой, анти-CRLF). */
  private catalogHeaders(creds: McCredentials): Record<string, string> {
    return { 'partner-id': stripCrlf(creds.partnerId) };
  }

  /**
   * Query-строка из заданных параметров: только непустые, значения URL-кодируются
   * (анти query-injection — значения уходят в URL запроса к MC, который потом
   * подписывается OAuth1). Возвращает `?k=v&...` или пустую строку.
   */
  // Принимает любой объект-набор фильтров (именованные *Query-типы или инлайн-
  // литерал); типобезопасность имён полей — на границе controller→service. Берём
  // только непустые СТРОКИ (значения от `?x[]=` и т.п. отбрасываем) и кодируем —
  // анти query-инъекция. Ключи задаёт код (не клиент).
  private qs(params: object): string {
    const pairs = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
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
