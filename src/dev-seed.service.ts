import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from './tenants/tenant.entity';
import { PLATFORM_TENANT, seedTenants } from './tenants/tenant.seed';

/**
 * Seeds the baseline `platform` tenant at startup — DEV HARNESS ONLY (zero-config for
 * `ts-node src/main.ts`, `npm run ping`, e2e). Registered in `AppModule`, NOT in the
 * embeddable `MastercardModule`: the module must not silently write tenants into the host
 * DB on bootstrap — the host provisions them itself (admin API or `npm run seed`).
 *
 * Seeds ONLY `platform` (the baseline for PLATFORM mode). Demo tenants (acme/own-*) are
 * NOT here — they come from `npm run seed` / e2e `beforeAll`. Idempotent
 * (`INSERT ... ON CONFLICT DO NOTHING`).
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
      this.logger.log(`Seeded baseline tenant: ${inserted.join(', ')}`);
    }
  }
}
