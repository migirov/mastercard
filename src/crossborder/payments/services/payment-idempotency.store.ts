import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpstreamUnavailableException } from '../../../common/utils/upstream.exception';
import { PaymentIdempotencyEntity } from '../entities/payment-idempotency.entity';

/**
 * Short in-progress lock (> MC's 30s timeout): if a process crashes between claiming the
 * slot and writing the result, the row is considered stale after LOCK_TTL and is
 * re-claimed by the next retry (the key never gets stuck forever). Completed (`done=true`)
 * rows live permanently — that is the payment idempotency itself.
 */
const LOCK_TTL_SECONDS = 120;

/**
 * Payment idempotency on PostgreSQL — the source of truth keyed on `transaction_reference`
 * (via `payment_idempotency`). Replaces the KV layer (`IdempotencyService` over
 * `kv_store`): same key → same result without re-calling MC. Behaviour preserved 1:1
 * (result cache, 409 in-progress, 422 "same key, different body", fail-safe on 5xx) — only
 * the backend changed.
 */
@Injectable()
export class PaymentIdempotencyStore {
  private readonly logger = new Logger(PaymentIdempotencyStore.name);

  constructor(
    @InjectRepository(PaymentIdempotencyEntity)
    private readonly repo: Repository<PaymentIdempotencyEntity>,
  ) {}

  async run<T>(
    tenantId: string,
    key: string | undefined,
    producer: () => Promise<T>,
    fingerprint: string,
  ): Promise<T> {
    if (!key) return producer(); // no key (no transaction_reference) — no idempotency

    // Claim the slot atomically: insert a NEW row, OR re-claim a STALE in-progress lock
    // (process crash). If the slot is held by a fresh in-progress call or already done —
    // returns false, and we resolve the existing row below.
    const owned = await this.acquire(tenantId, key, fingerprint);
    if (!owned) return this.resolveExisting<T>(tenantId, key, fingerprint);

    let result: T;
    try {
      result = await producer();
    } catch (e) {
      // Release the slot when the payment DEFINITELY did not go through (a retry is then
      // safe):
      //  - a client/business 4xx forwarded from MC (status < 500), or
      //  - MC 401/403 — our credentials were rejected at AUTH, nothing executed (the gateway
      //    surfaces this as UpstreamUnavailableException(executed='no'), a 502 to the client).
      // On 5xx / timeout / network the outcome is UNKNOWN (MC may have accepted it before the
      // drop) → do NOT touch the slot (fail-safe against double charges): a retry within
      // LOCK_TTL gets 409, after that it re-claims the lock, and MC dedups by
      // transaction_reference.
      const status = e instanceof HttpException ? e.getStatus() : 500;
      const definitelyNotExecuted =
        status < 500 ||
        (e instanceof UpstreamUnavailableException && e.executed === 'no');
      if (definitelyNotExecuted) await this.release(tenantId, key);
      throw e;
    }

    // The MC call SUCCEEDED — record the result. A write failure must NOT turn a successful
    // payment into an error for the client: return the result, the lock will expire by
    // LOCK_TTL.
    try {
      await this.repo.update(
        { tenantId, idemKey: key },
        { result: result as never, done: true },
      );
    } catch (err) {
      this.logger.error(
        `payment_idempotency: failed to record the result for '${key}': ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * Atomic slot claim in a single statement: `INSERT ... ON CONFLICT DO UPDATE`, where the
   * UPDATE fires ONLY for a stale in-progress lock (process crash) AND ONLY when the body
   * matches (`fingerprint = EXCLUDED.fingerprint`). `RETURNING id` is non-empty ⇔ we
   * inserted a new row OR re-claimed a stale one with the same body → we own the slot. A
   * fresh in-progress / done row / stale row with a DIFFERENT body → `WHERE` is false → 0
   * rows → resolved in `resolveExisting` (where "different body" → 422, consistent with the
   * fresh-lock path; otherwise 409). The body is NOT overwritten on re-claim (we only take
   * over a matching one), so `SET` touches only `lockedAt`.
   */
  private async acquire(
    tenantId: string,
    key: string,
    fingerprint: string,
  ): Promise<boolean> {
    const rows = await this.repo.query(
      `INSERT INTO payment_idempotency ("tenantId", "idemKey", fingerprint, done, "lockedAt")
       VALUES ($1, $2, $3, false, now())
       ON CONFLICT ("tenantId", "idemKey") DO UPDATE
         SET "lockedAt" = now()
         WHERE payment_idempotency.done = false
           AND payment_idempotency."lockedAt" < now() - make_interval(secs => $4)
           AND payment_idempotency.fingerprint = EXCLUDED.fingerprint
       RETURNING id`,
      [tenantId, key, fingerprint, LOCK_TTL_SECONDS],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  /**
   * Resolve an EXISTING row (the claim failed — the slot is taken): compares the body and
   * returns the ready result, otherwise 409 "already being processed". The row may have
   * vanished between the claim and the read (a concurrent 4xx release) → 409, the client
   * retries.
   */
  private async resolveExisting<T>(
    tenantId: string,
    key: string,
    fingerprint: string,
  ): Promise<T> {
    const row = await this.repo.findOne({ where: { tenantId, idemKey: key } });
    this.assertSameBody(row?.fingerprint, fingerprint);
    if (row?.done) return row.result as T;
    throw new ConflictException(
      'A payment with this transaction_reference is already being processed',
    );
  }

  /**
   * The same `transaction_reference` with a DIFFERENT body is a client error, not an
   * idempotent retry: otherwise a second (different) payment would silently return the
   * first one's result. 422 (per the IETF Idempotency-Key / Stripe semantics).
   */
  private assertSameBody(
    stored: string | undefined,
    fingerprint: string,
  ): void {
    if (stored && stored !== fingerprint) {
      throw new UnprocessableEntityException(
        'transaction_reference reused with a different request body',
      );
    }
  }

  /** Release the in-progress slot (only on a client 4xx — the payment did not go through). */
  private async release(tenantId: string, key: string): Promise<void> {
    await this.repo.delete({ tenantId, idemKey: key, done: false });
  }

  /**
   * True if THIS tenant has an idempotency record for the key — i.e. it actually initiated
   * the payment behind that `transaction_reference`. Used to authorize a PLATFORM tenant's
   * read of a shared-pool status event: pool events are keyed only by transaction_reference
   * (a client-chosen, guessable string), so a PLATFORM tenant may read one ONLY for a
   * transaction it owns, proven by the same `(tenantId, idemKey)` record the payment write
   * already enforces — not by guessing the reference.
   */
  async ownsKey(tenantId: string, key: string): Promise<boolean> {
    const count = await this.repo.count({ where: { tenantId, idemKey: key } });
    return count > 0;
  }
}
