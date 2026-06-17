/**
 * Засев тенантов в БД — для ЛОКАЛЬНОЙ разработки и e2e (НЕ для production):
 *   npm run seed                 — базовый platform (на старте) + демо-тенанты
 *   SEED_DEMO=false npm run seed  — только базовый platform (демо пропущены)
 *
 * Базовый `platform`-тенант засевается приложением на старте
 * (`TenantRegistry.onModuleInit`) во всех средах; этот скрипт добавляет
 * ДЕМО-тенантов (acme / own-sandbox / own-demo), которые из bootstrap'а убраны
 * (issue #5), чтобы встраиваемый модуль не плодил тестовые данные в БД хоста.
 * Идемпотентно (`INSERT ... ON CONFLICT DO NOTHING`). Конфиг БД (`DATABASE_URL`)
 * берётся из того же `.env`, что и приложение.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantEntity } from '../src/tenants/tenant.entity';
import { DEMO_TENANTS, seedTenants } from '../src/tenants/tenant.seed';

async function main() {
  const log = new Logger('seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const repo = app.get<Repository<TenantEntity>>(
    getRepositoryToken(TenantEntity),
  );

  if (process.env.SEED_DEMO === 'false') {
    log.log('SEED_DEMO=false — демо-тенанты пропущены (platform засеян на старте)');
  } else {
    const inserted = await seedTenants(repo, DEMO_TENANTS);
    log.log(
      inserted.length
        ? `Засеяны демо-тенанты: ${inserted.join(', ')}`
        : 'Демо-тенанты уже присутствуют — нечего засевать',
    );
  }

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  new Logger('seed').error(e.message);
  process.exit(1);
});
