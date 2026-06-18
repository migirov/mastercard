import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { stripCrlf } from '../../../common/utils/sanitize.util';
import { UpstreamHttpException } from '../../../common/utils/upstream.exception';
import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  McResponse,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { effectiveStatus, isActive } from '../../../tenants/tenant.types';

/** Бизнес/клиентские статусы Mastercard, которые осмысленно пробрасывать мерчанту. */
const FORWARDABLE_STATUSES = new Set([400, 404, 409, 422, 429]);

/**
 * Shared Cross-Border engine: the per-area services (accounts/quotes/payments/…)
 * build an McRequest and dispatch it through here. One place for tenant gating,
 * credential resolution, the MC call + response unwrapping, and the URL/header
 * helpers used while building requests. Split out of the former monolithic
 * CrossBorderService (issue #16).
 */
@Injectable()
export class CrossBorderGateway {
  private readonly logger = new Logger(CrossBorderGateway.name);

  constructor(
    private readonly registry: TenantRegistry,
    private readonly credentials: CredentialsService,
    private readonly client: MastercardClient,
  ) {}

  /**
   * Единый раннер операции: gating (resolveActive) → строим McRequest по
   * резолвленным creds → вызываем MC и разворачиваем ответ (call). Публичные
   * методы area-сервисов становятся одной строкой; вся повторяющаяся обвязка
   * (резолв + диспатч) здесь. `build` получает creds, потому что путь часто
   * зависит от partner(creds). Заголовочную стратегию area-сервис выбирает явно:
   * `mcRefHeaders(c)` для validation/guide, `catalogHeaders(c)` для cash-pickup,
   * либо без заголовков.
   */
  async run<T>(
    tenantId: string,
    ctx: string,
    build: (creds: McCredentials) => McRequest,
  ): Promise<T> {
    const creds = await this.resolveActive(tenantId);
    return this.call<T>(creds, build(creds), ctx);
  }

  /**
   * Резолвит credentials мерчанта, предварительно проверив, что он ACTIVE.
   * Gating: транзакции запрещены, пока нет двойного одобрения.
   */
  async resolveActive(tenantId: string): Promise<McCredentials> {
    const tenant = await this.registry.get(tenantId);
    if (!isActive(tenant)) {
      throw new ForbiddenException(
        `Tenant '${tenantId}' is not active (status ${effectiveStatus(tenant)})`,
      );
    }
    return this.credentials.resolve(tenant);
  }

  /**
   * Вызывает Mastercard и разворачивает ответ:
   *   2xx                       → данные;
   *   бизнес-4xx (400/404/...)  → проброс статуса и тела мерчанту;
   *   401/403/5xx/прочее        → 502, тело наружу не отдаём (может быть HTML
   *                               с внутренними ссылками), детали — в лог;
   *   сетевая ошибка            → 502.
   */
  async call<T>(creds: McCredentials, req: McRequest, ctx: string): Promise<T> {
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

  /** partner-id, безопасно подставляемый в путь (защита от path-injection в OWN). */
  partner(creds: McCredentials): string {
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
  mcRefHeaders(creds: McCredentials): Record<string, string> {
    return {
      'X-Mc-Correlation-Id': randomUUID(),
      'Partner-Ref-Id': stripCrlf(creds.partnerId),
    };
  }

  /** Заголовки Cash Pickup-каталога: partner-id в ЗАГОЛОВКЕ (сырой, анти-CRLF). */
  catalogHeaders(creds: McCredentials): Record<string, string> {
    return { 'partner-id': stripCrlf(creds.partnerId) };
  }

  /**
   * Query-строка из заданных параметров: только непустые, значения URL-кодируются
   * (анти query-injection — значения уходят в URL запроса к MC, который потом
   * подписывается OAuth1). Возвращает `?k=v&...` или пустую строку. Берём только
   * непустые СТРОКИ (значения от `?x[]=` и т.п. отбрасываем); ключи задаёт код.
   */
  qs(params: object): string {
    const pairs = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
  }
}
