import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Таблица `tx_status` — персист статусных push-уведомлений MC (Status Change /
 * Quote Status Change). Прод ведёт схему миграциями; в dev она же создаётся
 * через synchronize по метаданным TransactionStatusEntity.
 *
 * UNIQUE-индекс по "eventRef" даёт атомарный дедуп (INSERT ON CONFLICT DO NOTHING).
 * Колонка nullable → NULL'ы в Postgres различны, поэтому безref-события не
 * конфликтуют между собой.
 */
export class AddTxStatus1786000000000 implements MigrationInterface {
  name = 'AddTxStatus1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tx_status" ("id" SERIAL NOT NULL, "eventRef" character varying(200), "tenantId" character varying(64), "transactionReference" character varying(256), "eventType" character varying(32), "transactionType" character varying(16), "status" character varying(32), "stage" character varying(32), "payload" jsonb NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_tx_status_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tx_status_eventRef" ON "tx_status" ("eventRef") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tx_status_ref_tenant" ON "tx_status" ("transactionReference", "tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tx_status_receivedAt" ON "tx_status" ("receivedAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_tx_status_receivedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tx_status_ref_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_tx_status_eventRef"`);
    await queryRunner.query(`DROP TABLE "tx_status"`);
  }
}
