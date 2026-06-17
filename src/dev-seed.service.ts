import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from './tenants/tenant.entity';
import { PLATFORM_TENANT, seedTenants } from './tenants/tenant.seed';

/**
 * Засев базового `platform`-тенанта на старте — ТОЛЬКО для dev-харнесса (зеро-конфиг
 * для `ts-node src/main.ts`, `npm run ping`, e2e). Регистрируется в `AppModule`, а НЕ
 * во встраиваемом `MastercardModule`: модуль не должен молча писать тенантов в БД
 * хоста при bootstrap — хост провижит их сам (admin-API или `npm run seed`).
 *
 * Сеет ТОЛЬКО `platform` (baseline для PLATFORM-режима). Демо-тенанты
 * (acme/own-*) сюда НЕ входят — их ставит `npm run seed` / e2e `beforeAll`.
 * Идемпотентно (`INSERT ... ON CONFLICT DO NOTHING`).
 */
@Injectable()
export class DevSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevSeedService.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const inserted = await seedTenants(this.repo, [PLATFORM_TENANT]);
    if (inserted.length) {
      this.logger.log(`Засеян базовый тенант: ${inserted.join(', ')}`);
    }
  }
}
