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
import { TenantEntity } from '../database/entities/tenant.entity';
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

    if (process.env.NODE_ENV === 'production') {
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
    if (await this.repo.findOne({ where: { id } })) {
      throw new ConflictException(`Tenant '${id}' already exists`);
    }
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
    return this.repo.save(entity);
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
    const t = await this.repo.findOne({ where: { id } });
    if (!t) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }
    Object.assign(t, fields);
    return this.repo.save(t);
  }
}
