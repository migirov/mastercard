import { Inject, Injectable, Logger } from '@nestjs/common';
import { KV_STORE, KvStore } from '../store/kv.types';
import { TenantRegistry } from '../tenants/tenant.registry';
import { McWebhookEventDto } from './dto/mc-webhook-event.dto';
import { TransactionStatusStore } from './transaction-status.store';

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // сутки

/** Типы событий, которые несут статус транзакции/котировки → персистим. */
const STATUS_EVENT_TYPES = new Set(['STATUS_CHG', 'QUOTE_STATUS_CHG']);

/** Нормализованный срез события (camelCase ⊕ snake_case → единый вид). */
interface NormalizedEvent {
  ref: string | null; // eventRef ?? notificationId — ключ дедупа
  eventType: string | null;
  partnerId: string | null;
  transactionReference: string | null;
  transactionType: string | null;
  status: string | null;
  stage: string | null;
  raw: Record<string, unknown>;
}

type Ack = { status: 'accepted' | 'duplicate' };

/**
 * Обработка push-уведомлений Mastercard.
 * - Статусные события (STATUS_CHG/QUOTE_STATUS_CHG) → персист в `tx_status`;
 *   дедуп И запись атомарны через UNIQUE(eventRef) (INSERT ON CONFLICT DO NOTHING).
 * - Прочие события (Carded Rate Push, RFI и т.п.) → дедуп через KV + лог
 *   (бизнес-обработка по мере необходимости).
 * - MC шлёт поля и в camelCase, и в snake_case → нормализуем обе нотации.
 */
@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    @Inject(KV_STORE) private readonly kv: KvStore,
    private readonly statusStore: TransactionStatusStore,
    private readonly tenants: TenantRegistry,
  ) {}

  async handle(event: McWebhookEventDto): Promise<Ack> {
    // Зашифрованный push (mTLS-канал + JWE-тело). Декрипт ещё НЕ подключён:
    // нужен Client-ключ расшифровки + per-tenant seam (открытый блокер, MTF/Prod;
    // в sandbox push «Not Applicable»). Подтверждаем (иначе MC ретраит), но НЕ
    // обрабатываем — поля под шифром не видны, дедуп по ref невозможен.
    if (this.isEncrypted(event)) {
      this.logger.warn(
        'Зашифрованный push получен, но декрипт не подключён (Client-ключ/per-tenant, MTF/Prod) — ack без обработки.',
      );
      return { status: 'accepted' };
    }

    const n = this.normalize(event);

    if (n.eventType && STATUS_EVENT_TYPES.has(n.eventType)) {
      return this.handleStatus(n);
    }
    return this.handleOther(n);
  }

  /** Статусное событие → атомарный персист с дедупом по eventRef. */
  private async handleStatus(n: NormalizedEvent): Promise<Ack> {
    // Атрибуция тенанту: OWN → по partnerId; PLATFORM/неизвестный → общий пул (null).
    const tenantId = n.partnerId
      ? await this.tenants.findOwnTenantIdByPartnerId(n.partnerId)
      : null;

    const fresh = await this.statusStore.record({
      eventRef: n.ref,
      tenantId,
      transactionReference: n.transactionReference,
      eventType: n.eventType,
      transactionType: n.transactionType,
      status: n.status,
      stage: n.stage,
      payload: n.raw,
    });

    if (!fresh) {
      this.logger.log(
        `Дубликат статус-вебхука eventRef=${this.clip(n.ref)} — игнорируем`,
      );
      return { status: 'duplicate' };
    }
    this.logger.log(
      `Статус сохранён: tx=${this.clip(n.transactionReference)} type=${this.clip(n.transactionType)} status=${this.clip(n.status)}${n.stage ? `/${this.clip(n.stage)}` : ''}`,
    );
    return { status: 'accepted' };
  }

  /** Не-статусные события: дедуп через KV + лог (обработка — по мере надобности). */
  private async handleOther(n: NormalizedEvent): Promise<Ack> {
    if (n.ref) {
      const fresh = await this.kv.setIfAbsent(
        `wh:${n.ref}`,
        '1',
        DEDUP_TTL_SECONDS,
      );
      if (!fresh) {
        this.logger.log(
          `Дубликат вебхука eventRef=${this.clip(n.ref)} — игнорируем`,
        );
        return { status: 'duplicate' };
      }
    }
    this.logger.log(`Вебхук eventType=${this.clip(n.eventType)}`);
    return { status: 'accepted' };
  }

  /**
   * Санитайз значения для лога: тело вебхука НЕ подписано (держатель токена
   * контролирует поля), а часть из них (status/stage/transactionType) не покрыта
   * DTO-валидацией. Срезаем CR/LF (анти лог-инъекция: подделка строк лога) и
   * ограничиваем длину (анти раздувание лога).
   */
  private clip(v: string | null | undefined): string {
    if (v == null) return 'none';
    return v.replace(/[\r\n]/g, ' ').slice(0, 80);
  }

  /** Признак зашифрованного тела MC: `{ encrypted_payload: { data } }`. */
  private isEncrypted(event: McWebhookEventDto): boolean {
    const env = event as unknown as {
      encrypted_payload?: { data?: unknown };
    };
    return env?.encrypted_payload?.data != null;
  }

  /**
   * Сводит camelCase и snake_case к единому виду и достаёт статус/стадию из
   * типичных мест (quote.confirmStatus / cancelStatus или верхний уровень).
   * Поля сверх объявленных в DTO живут на объекте (passthrough, whitelist:false).
   */
  private normalize(event: McWebhookEventDto): NormalizedEvent {
    // `event ?? {}` — тело может прийти пустым/null (POST без тела) → без этого
    // обращение к свойствам уронило бы хендлер в 500 (а контракт — всегда 200).
    const r = (event ?? {}) as unknown as Record<string, any>;
    const eventRef = r.eventRef ?? r.event_ref ?? null;
    const notificationId = r.notificationId ?? r.notification_id ?? null;
    const quote = (r.quote ?? {}) as Record<string, any>;
    const confirm = (quote.confirmStatus ?? quote.cancelStatus ?? {}) as Record<
      string,
      any
    >;
    return {
      ref: eventRef ?? notificationId,
      eventType: r.eventType ?? r.event_type ?? null,
      partnerId: r.partnerId ?? r.partner_id ?? null,
      transactionReference:
        r.transactionReference ?? r.transaction_reference ?? null,
      transactionType: r.transactionType ?? r.transaction_type ?? null,
      status: confirm.status ?? r.status ?? null,
      stage: confirm.pendingStage ?? r.stage ?? null,
      raw: r,
    };
  }
}
