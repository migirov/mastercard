import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add a per-claim `lockToken` to `payment_idempotency`.
 *
 * `release`/`complete` used to scope on `(tenantId, idemKey)` — the SLOT, not the claim. The
 * slot is a single row (`UNIQUE(tenantId, idemKey)`) and the stale-reclaim path is
 * `ON CONFLICT DO UPDATE`, so after a reclaim the original acquirer and the reclaimer address
 * the SAME row with the SAME auto-increment id: the original's `release` would delete the row
 * the reclaimer now owns, and the reclaimer's result-write would silently match zero rows,
 * leaving a payment that succeeded at Mastercard with no idempotency record (the double-charge
 * lock this table exists to hold). A token regenerated on every (re)claim distinguishes the two
 * holders. `gen_random_uuid()` is core in PostgreSQL 13+ (no `pgcrypto` extension needed).
 *
 * Nullable with no default: `acquire` always sets it explicitly. Existing in-flight rows keep
 * NULL and finish under the pre-deploy code path; completed rows never need it again.
 */
export class PaymentIdemLockToken1785300000000 implements MigrationInterface {
  name = 'PaymentIdemLockToken1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_idempotency" ADD COLUMN "lockToken" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_idempotency" DROP COLUMN "lockToken"`,
    );
  }
}
