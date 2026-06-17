import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionStatusEntity } from '../entities/transaction-status.entity';

/** Поля для записи статус-события (всё, кроме автогенерируемых id/receivedAt). */
export interface TransactionStatusInput {
  eventRef?: string | null;
  tenantId?: string | null;
  transactionReference?: string | null;
  eventType?: string | null;
  transactionType?: string | null;
  status?: string | null;
  stage?: string | null;
  payload: Record<string, unknown>;
}

/** Безопасное окно выдачи статус-истории по одному ref (защита от раздувания ответа). */
const READ_LIMIT = 200;

/**
 * Status event types. `tx_status` now stores ALL webhooks (deduped by eventRef), but the
 * merchant status poll returns ONLY status events — the others (Carded Rate / RFI) sit there
 * for dedup+audit and never go out through this path.
 */
const STATUS_EVENT_TYPES = ['STATUS_CHG', 'QUOTE_STATUS_CHG'];

/**
 * Store for MC push notifications on top of PostgreSQL — the single source of truth for
 * webhook processing (dedup by eventRef for ALL events; status events additionally carry
 * status/stage and are read by the merchant). There is no separate KV dedup layer.
 */
@Injectable()
export class TransactionStatusStore {
  constructor(
    @InjectRepository(TransactionStatusEntity)
    private readonly repo: Repository<TransactionStatusEntity>,
  ) {}

  /**
   * Атомарная запись с дедупом по `eventRef`: `INSERT ... ON CONFLICT DO NOTHING
   * RETURNING id`. true = строка вставлена (свежее событие); false = конфликт
   * (дубликат — MC ретраит до 3 раз). Если `eventRef` отсутствует, строка всегда
   * вставляется (NULL'ы не конфликтуют) — дедуп для безref-событий невозможен.
   *
   * No length truncation: the projection columns (eventType/transactionType/status/stage)
   * are `text` (no width to overflow), and the indexed varchar columns are bounded upstream
   * — `eventRef`/`transactionReference` by the webhook DTO's `@MaxLength`, `tenantId` is an
   * internally resolved id. So a "value too long" → 500 (which would break the always-200
   * contract) cannot happen, and values are stored verbatim.
   */
  async record(input: TransactionStatusInput): Promise<boolean> {
    const res = await this.repo
      .createQueryBuilder()
      .insert()
      .into(TransactionStatusEntity)
      .values({
        eventRef: input.eventRef ?? null,
        tenantId: input.tenantId ?? null,
        transactionReference: input.transactionReference ?? null,
        eventType: input.eventType ?? null,
        transactionType: input.transactionType ?? null,
        status: input.status ?? null,
        stage: input.stage ?? null,
        // TypeORM QueryDeepPartialEntity рекурсивно разворачивает значения и не
        // принимает «сырой» Record для jsonb-колонки — кладём как есть через never.
        payload: input.payload as never,
      })
      .orIgnore() // ON CONFLICT DO NOTHING (по UNIQUE eventRef)
      .returning('id')
      .execute();
    return Array.isArray(res.raw) && res.raw.length > 0;
  }

  /**
   * Статус-события по `transaction_reference` для тенанта. OWN-тенант (includePool
   * = false) видит СТРОГО свои события (его push-и атрибутируются по partnerId,
   * в общий пул не попадают). PLATFORM-тенант (includePool = true) видит свои +
   * общий пул (`tenantId IS NULL`): у платформы общий partner-id, поэтому события
   * однозначно тенанту не привязываются и читаются по ref (который знает только
   * владелец транзакции). Сортировка по id ASC (хронология), с потолком строк.
   */
  async findForTenant(
    tenantId: string,
    transactionReference: string,
    includePool: boolean,
  ): Promise<TransactionStatusEntity[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.transactionReference = :ref', { ref: transactionReference })
      // Status events only: non-status ones (Carded Rate / RFI) also live in `tx_status`
      // for dedup, but must not appear in the merchant status read.
      .andWhere('s.eventType IN (:...statusTypes)', {
        statusTypes: STATUS_EVENT_TYPES,
      });
    if (includePool) {
      qb.andWhere('(s.tenantId = :t OR s.tenantId IS NULL)', { t: tenantId });
    } else {
      qb.andWhere('s.tenantId = :t', { t: tenantId });
    }
    return qb.orderBy('s.id', 'ASC').limit(READ_LIMIT).getMany();
  }
}
