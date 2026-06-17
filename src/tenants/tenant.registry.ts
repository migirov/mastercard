import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomToken } from '../common/crypto.util';
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
 * ЧИСТЫЙ data-layer: НЕ сеет ничего на старте — встраиваемый модуль не должен
 * писать в БД хоста при bootstrap. Засев тенантов вынесен наружу: базовый
 * `platform` — dev-харнесс (`DevSeedService` в `AppModule`), демо — `npm run seed`
 * (`scripts/seed.ts`); хост в проде провижит тенантов через admin-API или seed.
 * См. [tenant.seed.ts].
 */
@Injectable()
export class TenantRegistry {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

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

  /**
   * Резолв tenantId по partnerId для OWN-тенантов (атрибуция входящих
   * push-уведомлений). Только OWN: у PLATFORM partner-id общий → однозначно
   * тенанта не определить, такие события идут в общий пул (вернём null). Если
   * OWN-тенанта с таким partnerId нет — тоже null.
   */
  async findOwnTenantIdByPartnerId(partnerId: string): Promise<string | null> {
    const t = await this.repo.findOne({
      where: { partnerId, credentialMode: CredentialMode.OWN },
      select: ['id'],
    });
    return t?.id ?? null;
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
