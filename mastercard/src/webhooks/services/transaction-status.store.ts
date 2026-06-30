import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionStatusEntity } from '../entities/transaction-status.entity';
import { STATUS_EVENT_TYPES } from '../webhook.constants';

/** Fields for writing a status event (everything except the auto-generated id/receivedAt). */
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

/** Safe window for returning status history per ref (guards against response bloat). */
const READ_LIMIT = 200;

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
   * Atomic write with dedup by `eventRef`: `INSERT ... ON CONFLICT DO NOTHING
   * RETURNING id`. true = row inserted (a fresh event); false = conflict
   * (a duplicate — MC retries up to 3 times). If `eventRef` is absent, the row is always
   * inserted (NULLs do not conflict) — dedup is impossible for ref-less events.
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
        // TypeORM's QueryDeepPartialEntity recursively unwraps values and does not
        // accept a raw Record for a jsonb column — pass it through as-is via never.
        payload: input.payload as never,
      })
      .orIgnore() // ON CONFLICT DO NOTHING (on UNIQUE eventRef)
      .returning('id')
      .execute();
    return Array.isArray(res.raw) && res.raw.length > 0;
  }

  /**
   * Status events by `transaction_reference` for a tenant. An OWN tenant (includePool
   * = false) sees STRICTLY its own events (its pushes are attributed by partnerId and
   * never land in the shared pool). A PLATFORM tenant (includePool = true) sees its own +
   * the shared pool (`tenantId IS NULL`): the platform has a shared partner-id, so events
   * cannot be attributed to a tenant unambiguously and are read by ref (which only the
   * transaction owner knows). Ordered by id ASC (chronology), with a row ceiling.
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
