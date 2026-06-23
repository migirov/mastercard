import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persists MC push notifications — the single source of truth for webhook processing (no
 * KV layer). Status events (Status Change / Quote Status Change) carry status/stage and are
 * read by the merchant; others (Carded Rate / RFI) sit there for dedup+audit.
 *
 * `eventRef` UNIQUE → dedup AND the write are atomic (a single `INSERT ... ON CONFLICT
 * DO NOTHING`), which removes the "hard crash between marking the dedup and writing the
 * status" risk. `eventRef` is nullable: if an event has no ref, dedup is impossible —
 * Postgres treats NULLs as DISTINCT, so such rows are always inserted (rather than
 * conflicting with each other).
 *
 * `tenantId` is nullable by the attribution decision: for an OWN tenant it is resolved by
 * `partnerId`; for PLATFORM (shared partner-id, tenant cannot be determined unambiguously)
 * it is NULL (shared pool, read by the merchant via transaction_reference).
 */
// The index leads with transactionReference: the only read path is by ref
// (`findForTenant`), tenantId is a secondary filter. A ref-leading index serves
// both "by ref" and "by ref+tenant".
@Entity('tx_status')
@Index(['transactionReference', 'tenantId'])
export class TransactionStatusEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  eventRef?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  transactionReference?: string | null;

  // Projection columns (eventType/transactionType/status/stage): convenience fields
  // pulled from arbitrary spots of the MC payload and NOT length-validated by the DTO.
  // They are `text` (no width) on purpose — so there is nothing to overflow (no
  // "value too long" → 500 → broken "always 200" webhook contract) and nothing to
  // truncate in the store. The full event is preserved in `payload` (jsonb) regardless,
  // and these columns are not indexed, so an over-long value costs nothing extra.
  @Column({ type: 'text', nullable: true })
  eventType?: string | null;

  /** QUOTE | PAYMENT (from the event's transactionType). */
  @Column({ type: 'text', nullable: true })
  transactionType?: string | null;

  @Column({ type: 'text', nullable: true })
  status?: string | null;

  @Column({ type: 'text', nullable: true })
  stage?: string | null;

  /** The full raw (normalized) event — so MC's extra fields are not lost. */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}
