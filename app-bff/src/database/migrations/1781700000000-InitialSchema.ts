import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for the demo BFF: a single generic `records` table backing every
 * entity type (Invoice, VirtualCard, Employee, …), keyed by `entityType`,
 * with the variable fields in a jsonb `data` column. Hand-written (not CLI-generated)
 * so it can be reasoned about directly. `gen_random_uuid()` is built into Postgres 13+
 * (pgcrypto in older versions), so no extension is needed on the compose `postgres:16`.
 */
export class InitialSchema1781700000000 implements MigrationInterface {
  name = 'InitialSchema1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "records" (` +
        `"id" uuid NOT NULL DEFAULT gen_random_uuid(), ` +
        `"entityType" character varying NOT NULL, ` +
        `"data" jsonb NOT NULL DEFAULT '{}', ` +
        `"created_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_records_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_records_entityType" ON "records" ("entityType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_records_entityType"`);
    await queryRunner.query(`DROP TABLE "records"`);
  }
}
