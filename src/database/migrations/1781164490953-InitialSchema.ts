import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1781164490953 implements MigrationInterface {
  name = 'InitialSchema1781164490953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "ts" TIMESTAMP WITH TIME ZONE NOT NULL, "tenantId" character varying(64), "source" character varying(16), "method" character varying(8) NOT NULL, "path" character varying(512) NOT NULL, "status" integer NOT NULL, "ms" integer NOT NULL, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a2aa939264fc4284d5c6552ce4" ON "audit_log" ("ts") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4167b21288ab6e16239cb1d501" ON "audit_log" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "kv_store" ("key" character varying(256) NOT NULL, "value" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a9c11644aa565bf7675e6bd23ef" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_71bfaef45238ce1a199f4366e2" ON "kv_store" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("clientId" character varying(64) NOT NULL, "tenantId" character varying(64) NOT NULL, "secretHash" character varying(128) NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0c094fe1ef0a6c4af8f2b10be7" PRIMARY KEY ("clientId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5" ON "oauth_clients" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" character varying(64) NOT NULL, "name" character varying(160) NOT NULL, "credentialMode" character varying(16) NOT NULL, "partnerId" character varying(128), "secretRef" character varying(256), "platformApproved" boolean NOT NULL DEFAULT false, "mcApproved" boolean NOT NULL DEFAULT false, "suspended" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e8a0bd886e6bd30d73e90ffbb5"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_71bfaef45238ce1a199f4366e2"`,
    );
    await queryRunner.query(`DROP TABLE "kv_store"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4167b21288ab6e16239cb1d501"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a2aa939264fc4284d5c6552ce4"`,
    );
    await queryRunner.query(`DROP TABLE "audit_log"`);
  }
}
