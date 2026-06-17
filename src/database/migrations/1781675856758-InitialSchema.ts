import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1781675856758 implements MigrationInterface {
    name = 'InitialSchema1781675856758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "oauth_clients" ("clientId" character varying(64) NOT NULL, "tenantId" character varying(64) NOT NULL, "secretHash" character varying(128) NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0c094fe1ef0a6c4af8f2b10be7" PRIMARY KEY ("clientId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5" ON "oauth_clients" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "payment_idempotency" ("id" SERIAL NOT NULL, "tenantId" character varying(64) NOT NULL, "idemKey" character varying(80) NOT NULL, "fingerprint" character varying(64) NOT NULL, "result" jsonb, "done" boolean NOT NULL DEFAULT false, "lockedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_payment_idem_tenant_key" UNIQUE ("tenantId", "idemKey"), CONSTRAINT "PK_4be4e972a15c094647f094112db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_061661af16f73644c1a602512e" ON "payment_idempotency" ("lockedAt") `);
        await queryRunner.query(`CREATE TABLE "tx_status" ("id" SERIAL NOT NULL, "eventRef" character varying(200), "tenantId" character varying(64), "transactionReference" character varying(256), "eventType" character varying(32), "transactionType" character varying(16), "status" character varying(32), "stage" character varying(32), "payload" jsonb NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_894e1b0e08a8ef28c456755d849" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bf9c03412951dd120be7ae41fa" ON "tx_status" ("eventRef") `);
        await queryRunner.query(`CREATE INDEX "IDX_955760658d81f9cbbe08523e1b" ON "tx_status" ("receivedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_efb06850af2f5a2045b55cbf97" ON "tx_status" ("transactionReference", "tenantId") `);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "ts" TIMESTAMP WITH TIME ZONE NOT NULL, "tenantId" character varying(64), "source" character varying(16), "method" character varying(8) NOT NULL, "path" character varying(512) NOT NULL, "status" integer NOT NULL, "ms" integer NOT NULL, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a2aa939264fc4284d5c6552ce4" ON "audit_log" ("ts") `);
        await queryRunner.query(`CREATE INDEX "IDX_4167b21288ab6e16239cb1d501" ON "audit_log" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" character varying(64) NOT NULL, "name" character varying(160) NOT NULL, "credentialMode" character varying(16) NOT NULL, "partnerId" character varying(128), "secretRef" character varying(256), "platformApproved" boolean NOT NULL DEFAULT false, "mcApproved" boolean NOT NULL DEFAULT false, "suspended" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6ad29f70b20275660ba5a35245" ON "tenants" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6ad29f70b20275660ba5a35245"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4167b21288ab6e16239cb1d501"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a2aa939264fc4284d5c6552ce4"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_efb06850af2f5a2045b55cbf97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_955760658d81f9cbbe08523e1b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf9c03412951dd120be7ae41fa"`);
        await queryRunner.query(`DROP TABLE "tx_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_061661af16f73644c1a602512e"`);
        await queryRunner.query(`DROP TABLE "payment_idempotency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8a0bd886e6bd30d73e90ffbb5"`);
        await queryRunner.query(`DROP TABLE "oauth_clients"`);
    }

}
