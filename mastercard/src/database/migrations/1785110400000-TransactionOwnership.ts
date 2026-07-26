import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `tx_ownership` — the local resource→tenant binding that authorizes PLATFORM sub-merchants
 * (they share one MC partner-id, so Mastercard cannot attribute a resource to one of them).
 *
 * The two backfills are what make this safe to deploy: without them every PLATFORM tenant
 * would 404 on transactions it legitimately created before this migration ran. `idemKey` is
 * literally `'txref:' + sha256hex(transaction_reference)`, so the hash is recoverable exactly
 * from the existing idempotency rows — no re-derivation from plaintext is needed.
 *
 * `done = true` in the claim backfill is deliberate and mirrors the ownership rule itself: an
 * in-flight or abandoned lock is not proof that the tenant completed the payment.
 */
export class TransactionOwnership1785110400000 implements MigrationInterface {
  name = 'TransactionOwnership1785110400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tx_ownership" ("id" SERIAL NOT NULL, "tenantId" character varying(64) NOT NULL, "refHash" character varying(64) NOT NULL, "mcPaymentId" character varying(128), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_tx_ownership_tenant_ref" UNIQUE ("tenantId", "refHash"), CONSTRAINT "PK_tx_ownership_id" PRIMARY KEY ("id"))`,
    );

    // PARTIAL: only payment rows carry an id, and only those are ever looked up by it.
    await queryRunner.query(
      `CREATE INDEX "IDX_tx_ownership_mc_payment_id" ON "tx_ownership" ("mcPaymentId") WHERE "mcPaymentId" IS NOT NULL`,
    );

    // Backfill 1 — claims for every COMPLETED payment.
    await queryRunner.query(
      `INSERT INTO "tx_ownership" ("tenantId", "refHash")
       SELECT "tenantId", substring("idemKey" from 7)
       FROM "payment_idempotency"
       WHERE "done" = true AND "idemKey" LIKE 'txref:%'
       ON CONFLICT ("tenantId", "refHash") DO NOTHING`,
    );

    // Backfill 2 — attach the MC payment id from the cached response where we have one.
    await queryRunner.query(
      `UPDATE "tx_ownership" o
       SET "mcPaymentId" = p."result"->'payment'->>'id'
       FROM "payment_idempotency" p
       WHERE p."done" = true
         AND p."idemKey" LIKE 'txref:%'
         AND o."tenantId" = p."tenantId"
         AND o."refHash" = substring(p."idemKey" from 7)
         AND p."result"->'payment'->>'id' IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Both backfills are derived data — dropping the table loses nothing that cannot be
    // reconstructed from `payment_idempotency` by re-running `up`.
    await queryRunner.query(`DROP INDEX "public"."IDX_tx_ownership_mc_payment_id"`);
    await queryRunner.query(`DROP TABLE "tx_ownership"`);
  }
}
