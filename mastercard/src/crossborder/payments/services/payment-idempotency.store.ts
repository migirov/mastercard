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
    // (process crash). Returns a per-claim lock token we own, or null if the slot is held by a
    // fresh in-progress call or is already done — then we resolve the existing row below.
    const lockToken = await this.acquire(tenantId, key, fingerprint);
    if (!lockToken) return this.resolveExisting<T>(tenantId, key, fingerprint);

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
      // transaction_reference. Scoped to OUR lockToken: if the slot went stale and was
      // re-claimed by another caller mid-flight, we must not delete the row it now owns.
      const status = e instanceof HttpException ? e.getStatus() : 500;
      const definitelyNotExecuted =
        status < 500 ||
        (e instanceof UpstreamUnavailableException && e.executed === 'no');
      if (definitelyNotExecuted) await this.release(lockToken);
      throw e;
    }

    // The MC call SUCCEEDED — record the result under OUR lock.
    await this.complete(lockToken, result);
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
   * over a matching one), so `SET` touches `lockedAt` and a FRESH `lockToken`.
   *
   * Returns the row's `lockToken` (a per-claim uuid regenerated on every insert/reclaim) so the
   * caller can scope `release`/`complete` to the exact claim it holds. The auto-increment `id`
   * cannot serve this: `DO UPDATE` mutates the one row in place, so `id` is identical for the
   * original acquirer and a stale re-claimer, and scoping to it would let one caller's cleanup
   * clobber the other's live claim.
   */
  private async acquire(
    tenantId: string,
    key: string,
    fingerprint: string,
  ): Promise<string | null> {
    const rows = await this.repo.query(
      `INSERT INTO payment_idempotency ("tenantId", "idemKey", fingerprint, done, "lockedAt", "lockToken")
       VALUES ($1, $2, $3, false, now(), gen_random_uuid())
       ON CONFLICT ("tenantId", "idemKey") DO UPDATE
         SET "lockedAt" = now(), "lockToken" = gen_random_uuid()
         WHERE payment_idempotency.done = false
           AND payment_idempotency."lockedAt" < now() - make_interval(secs => $4)
           AND payment_idempotency.fingerprint = EXCLUDED.fingerprint
       RETURNING "lockToken"`,
      [tenantId, key, fingerprint, LOCK_TTL_SECONDS],
    );
    return Array.isArray(rows) && rows.length > 0
      ? String(rows[0].lockToken)
      : null;
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

  /**
   * Release the in-progress slot (only on a client 4xx — the payment did not go through).
   * Scoped to OUR `lockToken` (never `(tenantId, idemKey)`): a stale reclaim gives the row a new
   * token, so a `delete` keyed on the slot could remove a claim another caller now holds. The
   * `done: false` guard additionally refuses to delete a completed row.
   */
  private async release(lockToken: string): Promise<void> {
    await this.repo.delete({ lockToken, done: false });
  }

  /**
   * Record the successful result under OUR lock. Scoped to `lockToken`, same reasoning as
   * `release`. A write failure must NOT turn a payment that already succeeded at Mastercard into
   * an error for the client — swallow it and let the lock expire by LOCK_TTL. `affected === 0`
   * means our lock was reclaimed and completed by someone else while we were in flight: log it
   * loudly, because it means two producers reached Mastercard for one `transaction_reference`.
   */
  private async complete(lockToken: string, result: unknown): Promise<void> {
    try {
      const res = await this.repo.update(
        { lockToken },
        { result: result as never, done: true },
      );
      if (!res.affected) {
        this.logger.error(
          'payment_idempotency: lock reclaimed before completion — possible duplicate submission',
        );
      }
    } catch (err) {
      this.logger.error(
        `payment_idempotency: failed to record the result: ${(err as Error).message}`,
      );
    }
  }
}
