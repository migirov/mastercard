/**
 * Seed tenants into the DB — for LOCAL development and e2e (NOT for production):
 *   npm run seed                 — baseline platform (on boot) + demo tenants
 *   SEED_DEMO=false npm run seed  — only the baseline platform (demo skipped)
 *
 * The baseline `platform` tenant is seeded by the dev harness on boot (`DevSeedService`);
 * this script adds the DEMO tenants (acme / own-sandbox / own-demo), which were removed
 * from the bootstrap (issue #5) so the embeddable module doesn't breed test data in the
 * host DB. Idempotent (`INSERT ... ON CONFLICT DO NOTHING`). The DB config (`DATABASE_URL`)
 * comes from the same `.env` as the app.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/harness/app.module';
import { TenantEntity } from '../src/tenants/entities/tenant.entity';
import { DEMO_TENANTS, seedTenants } from '../src/tenants/services/tenant.seed';

async function main() {
  const log = new Logger('seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const repo = app.get<Repository<TenantEntity>>(
    getRepositoryToken(TenantEntity),
  );

  if (process.env.SEED_DEMO === 'false') {
    log.log('SEED_DEMO=false — demo tenants skipped (platform seeded on boot)');
  } else {
    const inserted = await seedTenants(repo, DEMO_TENANTS);
    log.log(
      inserted.length
        ? `Seeded demo tenants: ${inserted.join(', ')}`
        : 'Demo tenants already present — nothing to seed',
    );
  }

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  new Logger('seed').error(e.message);
  process.exit(1);
});
