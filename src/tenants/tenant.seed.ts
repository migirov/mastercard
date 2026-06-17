import { Repository } from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { CredentialMode } from './tenant.types';

/** A tenant seed row (id required; the rest as in TenantEntity). */
export type TenantSeed = Partial<TenantEntity> & { id: string };

/**
 * The baseline PLATFORM tenant (the platform's shared keys). Needed for PLATFORM mode in
 * ALL environments → seeded at app startup (`DevSeedService`), not demo data. Idempotent.
 */
export const PLATFORM_TENANT: TenantSeed = {
  id: 'platform',
  name: 'Platform (shared keys)',
  credentialMode: CredentialMode.PLATFORM,
  platformApproved: true,
  mcApproved: true,
  suspended: false,
};

/**
 * Demo tenants for local development and e2e — NOT for production. Seeded ONLY by the seed
 * script (`npm run seed`) or the e2e harness, not by the app bootstrap (so startup doesn't
 * breed test data inside the embeddable module). `own-*` reference secretRefs of the local
 * SecretStore (dev certificates).
 */
export const DEMO_TENANTS: TenantSeed[] = [
  {
    id: 'acme',
    name: 'ACME Corp',
    credentialMode: CredentialMode.PLATFORM,
    platformApproved: true,
    mcApproved: true,
    suspended: false,
  },
  {
    id: 'own-sandbox',
    name: 'Own-keys sandbox demo',
    credentialMode: CredentialMode.OWN,
    secretRef: 'mc/tenants/own-sandbox',
    platformApproved: true,
    mcApproved: true,
    suspended: false,
  },
  {
    id: 'own-demo',
    name: 'Own-keys demo (pending)',
    credentialMode: CredentialMode.OWN,
    partnerId: 'OWN_PARTNER_TBD',
    secretRef: 'mc/tenants/own-demo',
    platformApproved: false,
    mcApproved: false,
    suspended: false,
  },
];

/**
 * Idempotent tenant seeding: one `INSERT ... ON CONFLICT DO NOTHING` per tenant. Race-free
 * when several pods start at once (a findOne→save would crash boot on a duplicate key);
 * existing rows are NOT overwritten — admin approval/suspend edits survive. Returns the ids
 * actually inserted (for logging/tests).
 */
export async function seedTenants(
  repo: Repository<TenantEntity>,
  tenants: TenantSeed[],
): Promise<string[]> {
  const inserted: string[] = [];
  for (const t of tenants) {
    const res = await repo
      .createQueryBuilder()
      .insert()
      .into(TenantEntity)
      .values(t)
      .orIgnore() // ON CONFLICT DO NOTHING
      .returning('id')
      .execute();
    if (Array.isArray(res.raw) && res.raw.length > 0) inserted.push(t.id);
  }
  return inserted;
}
