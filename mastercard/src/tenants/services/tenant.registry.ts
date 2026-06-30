import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomToken } from '../../common/utils/crypto.util';
import { TenantEntity } from '../entities/tenant.entity';
import { CredentialMode, Tenant } from '../tenant.types';

export interface CreateTenantInput {
  id?: string;
  name: string;
  credentialMode: CredentialMode;
  partnerId?: string;
  secretRef?: string;
}

/**
 * Partner registry on top of PostgreSQL (the source of truth, shared across all pods).
 * A PURE data layer: it seeds NOTHING on startup — the embeddable module must not write to
 * the host DB on bootstrap. Tenant seeding lives outside: the baseline `platform` via the
 * dev harness (`DevSeedService` in `AppModule`), demo via `npm run seed` (`scripts/seed.ts`);
 * in prod the host provisions tenants via the admin API or seed. See [tenant.seed.ts].
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
   * Resolves tenantId by partnerId for OWN tenants (attribution of incoming push
   * notifications). OWN only: PLATFORM has a shared partner-id → the tenant cannot be
   * determined unambiguously, such events go to the shared pool (returns null). If there
   * is no OWN tenant with that partnerId — also null.
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
      // INSERT (not save): on a PK collision Postgres throws a unique-violation
      // (23505) rather than silently UPDATE over an existing tenant — otherwise a
      // repeated/racing create with the same id would overwrite the row and RESET approvals.
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
    // A column-scoped UPDATE (not a read-modify-write of the whole row via save): otherwise
    // two concurrent approval toggles from different pods would read one snapshot and
    // overwrite each other (loss of mcApproved/suspended — security-relevant).
    const res = await this.repo.update({ id }, fields);
    if (!res.affected) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }
    return this.get(id);
  }
}
