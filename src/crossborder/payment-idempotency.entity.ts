import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Payment idempotency on top of PostgreSQL — the source of truth keyed on
 * `transaction_reference` (the payment's business key at MC). Replaces the former KV
 * layer (`kv_store` + IdempotencyService): a retry with the same `transaction_reference`
 * → the same result WITHOUT re-calling MC (double-charge protection).
 *
 * `(tenantId, idemKey)` UNIQUE → claiming the slot AND the race protection are atomic
 * (one `INSERT ... ON CONFLICT`). `idemKey` = `txref:sha256(transaction_reference)`
 * (a hash — the client's ref can be any length/charset; tenant scopes the key).
 *
 * Row semantics:
 *   - `done=false`            — slot claimed, the MC call is in-progress (a short lock:
 *                               `lockedAt`; once stale, the next retry re-claims it so a
 *                               process crash can't pin the key forever);
 *   - `done=true` + `result`  — the MC call finished, response cached (retries are served
 *                               from the DB, MC is not hit). Completed rows are NOT
 *                               deleted (permanent idempotency — safer than the old 24h
 *                               TTL: one `transaction_reference` = one payment forever).
 *   - `fingerprint`           — sha256 of the body: same ref with a DIFFERENT body → 422.
 */
@Entity('payment_idempotency')
@Unique('UQ_payment_idem_tenant_key', ['tenantId', 'idemKey'])
export class PaymentIdempotencyEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  /** `txref:sha256(transaction_reference)` — 6 + 64 hex. */
  @Column({ type: 'varchar', length: 80 })
  idemKey!: string;

  /** sha256(JSON of the payment body) — detects "same key, different body" (→ 422). */
  @Column({ type: 'varchar', length: 64 })
  fingerprint!: string;

  /** Cached MC response; NULL while the call is in-progress (`done=false`). */
  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  done!: boolean;

  /**
   * Moment the slot was claimed/re-claimed. For in-progress rows (`done=false`) it acts
   * as a short lock: a row older than LOCK_TTL is treated as "stale" (the process crashed
   * between claiming and writing the result) and is re-claimed by the next retry.
   * Deliberately NOT indexed: `lockedAt` is only checked inside `acquire` as a filter on a
   * row already located by UNIQUE(tenantId, idemKey) (not an index scan), and there is no
   * background cleanup by `lockedAt` — an index would be dead write overhead.
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  lockedAt!: Date;
}
