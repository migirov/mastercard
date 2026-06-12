import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomToken } from '../common/crypto.util';
import { GatewayConfig } from '../config/gateway-config';
import { TenantEntity } from './tenant.entity';
import { CredentialMode, Tenant } from './tenant.types';

export interface CreateTenantInput {
  id?: string;
  name: string;
  credentialMode: CredentialMode;
  partnerId?: string;
  secretRef?: string;
}

/**
 * Реестр партнёров поверх PostgreSQL (источник истины, общий для всех подов).
 */
@Injectable()
export class TenantRegistry implements OnModuleInit {
  private readonly logger = new Logger(TenantRegistry.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
    private readonly config: GatewayConfig,
  ) {}

  /** Засев демо-тенантов (идемпотентно; в production — только platform). */
  async onModuleInit(): Promise<void> {
    await this.seedIfAbsent({
      id: 'platform',
      name: 'Platform (shared keys)',
      credentialMode: CredentialMode.PLATFORM,
      platformApproved: true,
      mcApproved: true,
      suspended: false,
    });

    if (this.config.isProduction) {
      this.logger.log('production: тестовые тенанты не засеяны');
      return;
    }
    await this.seedIfAbsent({
      id: 'acme',
      name: 'ACME Corp',
      credentialMode: CredentialMode.PLATFORM,
      platformApproved: true,
      mcApproved: true,
      suspended: false,
    });
    await this.seedIfAbsent({
      id: 'own-sandbox',
      name: 'Own-keys sandbox demo',
      credentialMode: CredentialMode.OWN,
      secretRef: 'mc/tenants/own-sandbox',
      platformApproved: true,
      mcApproved: true,
      suspended: false,
    });
    await this.seedIfAbsent({
      id: 'own-demo',
      name: 'Own-keys demo (pending)',
      credentialMode: CredentialMode.OWN,
      partnerId: 'OWN_PARTNER_TBD',
      secretRef: 'mc/tenants/own-demo',
      platformApproved: false,
      mcApproved: false,
      suspended: false,
    });
  }

  private async seedIfAbsent(t: Partial<TenantEntity> & { id: string }) {
    // ON CONFLICT DO NOTHING — атомарно и без гонок при одновременном старте
    // нескольких подов (findOne→save ронял бы boot на duplicate key). Существующую
    // запись НЕ перезаписываем — admin-правки approval/suspend сохраняются.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(TenantEntity)
      .values(t)
      .orIgnore()
      .execute();
  }

  async get(id: string): Promise<Tenant> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }
    return t;
  }

  async list(): Promise<Tenant[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async create(input: CreateTenantInput): Promise<Tenant> {
    const id = input.id ?? `t_${randomToken(6)}`;
    const entity = this.repo.create({
      id,
      name: input.name,
      credentialMode: input.credentialMode,
      partnerId: input.partnerId,
      secretRef: input.secretRef,
      platformApproved: false,
      mcApproved: false,
      suspended: false,
    });
    try {
      // INSERT (а не save): при коллизии PK Postgres бросит unique-violation
      // (23505), а не молча сделает UPDATE поверх существующего тенанта — иначе
      // повторный/гоночный create с тем же id затёр бы запись и СБРОСИЛ одобрения.
      await this.repo.insert(entity);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException(`Tenant '${id}' already exists`);
      }
      throw e;
    }
    return entity;
  }

  async setPlatformApproved(id: string, value: boolean): Promise<Tenant> {
    return this.patch(id, { platformApproved: value });
  }

  async setMcApproved(id: string, value: boolean): Promise<Tenant> {
    return this.patch(id, { mcApproved: value });
  }

  async setSuspended(id: string, value: boolean): Promise<Tenant> {
    return this.patch(id, { suspended: value });
  }

  private async patch(
    id: string,
    fields: Partial<TenantEntity>,
  ): Promise<Tenant> {
    // Колоночный UPDATE (а не read-modify-write всей строки через save): иначе
    // два конкурентных тогла одобрения с разных подов читали бы один снимок и
    // перезаписывали друг друга (потеря mcApproved/suspended — security-релевантно).
    const res = await this.repo.update({ id }, fields);
    if (!res.affected) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }
    return this.get(id);
  }
}
