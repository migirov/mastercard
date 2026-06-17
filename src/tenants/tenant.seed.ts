import { Repository } from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { CredentialMode } from './tenant.types';

/** Сид-запись тенанта (id обязателен; остальное — как в TenantEntity). */
export type TenantSeed = Partial<TenantEntity> & { id: string };

/**
 * Базовый PLATFORM-тенант (общие ключи платформы). Нужен для PLATFORM-режима во
 * ВСЕХ средах → засевается на старте приложения (`TenantRegistry.onModuleInit`),
 * не демо-данные. Идемпотентно.
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
 * Демо-тенанты для локальной разработки и e2e — НЕ для production. Засеваются
 * ТОЛЬКО seed-скриптом (`npm run seed`) или e2e-харнессом, а не bootstrap'ом
 * приложения (чтобы старт не плодил тестовые данные во встраиваемом модуле).
 * `own-*` ссылаются на secretRef'ы локального SecretStore (dev-сертификаты).
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
 * Идемпотентный засев тенантов: на каждый — `INSERT ... ON CONFLICT DO NOTHING`.
 * Без гонок при одновременном старте нескольких подов (findOne→save ронял бы boot
 * на duplicate key); существующие записи НЕ перезаписываются — admin-правки
 * approval/suspend сохраняются. Возвращает id РЕАЛЬНО вставленных (для лога/тестов).
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
