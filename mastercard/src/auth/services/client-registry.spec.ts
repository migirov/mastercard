import { Repository } from 'typeorm';
import { sha256hex } from '../../common/utils/crypto.util';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { Tenant } from '../../tenants/tenant.types';
import { OAuthClientEntity } from '../entities/oauth-client.entity';
import { ClientRegistry } from './client-registry';

const SECRET = 'super-secret-token-value';

const activeTenant = {
  id: 'acme',
  suspended: false,
  platformApproved: true,
  mcApproved: true,
} as unknown as Tenant;

function make(opts?: {
  client?: Partial<OAuthClientEntity> | null;
  tenant?: Tenant;
  tenantThrows?: boolean;
}) {
  const client =
    opts?.client === null
      ? null
      : {
          clientId: 'mc_abc',
          tenantId: 'acme',
          secretHash: sha256hex(SECRET),
          revoked: false,
          ...opts?.client,
        };
  const repo = {
    findOne: jest.fn(async () => client),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const tenants = {
    get: jest.fn(async () => {
      if (opts?.tenantThrows) throw new Error('not found');
      return opts?.tenant ?? activeTenant;
    }),
  };
  const svc = new ClientRegistry(
    repo as unknown as Repository<OAuthClientEntity>,
    tenants as unknown as TenantRegistry,
  );
  return { svc, repo, tenants };
}

describe('ClientRegistry.validate', () => {
  it('valid credentials for an active tenant → tenantId', async () => {
    const { svc } = make();
    await expect(svc.validate('mc_abc', SECRET)).resolves.toBe('acme');
  });

  it('wrong secret → null', async () => {
    const { svc } = make();
    await expect(svc.validate('mc_abc', 'wrong')).resolves.toBeNull();
  });

  it('revoked client → null', async () => {
    const { svc } = make({ client: { revoked: true } });
    await expect(svc.validate('mc_abc', SECRET)).resolves.toBeNull();
  });

  // F12b: without this a suspended tenant keeps minting fresh 15-minute tokens until an
  // admin separately revokes the client — which is an action an operator may never take.
  it('SUSPENDED tenant → null even with correct credentials', async () => {
    const suspended = { ...activeTenant, suspended: true } as Tenant;
    const { svc } = make({ tenant: suspended });
    await expect(svc.validate('mc_abc', SECRET)).resolves.toBeNull();
  });

  // Deliberately allowed: a tenant mid-onboarding must be able to authenticate and receive a
  // clear 403 from resolveActive on business calls. Denying the token would surface as
  // `invalid_client`, which is misleading and would break the shipped own-demo seed.
  it('PENDING (not dual-approved, not suspended) tenant → still issued', async () => {
    const pending = {
      ...activeTenant,
      platformApproved: false,
      mcApproved: false,
    } as Tenant;
    const { svc } = make({ tenant: pending });
    await expect(svc.validate('mc_abc', SECRET)).resolves.toBe('acme');
  });

  it('a client whose tenant no longer exists → null, not a thrown 500', async () => {
    const { svc } = make({ tenantThrows: true });
    await expect(svc.validate('mc_abc', SECRET)).resolves.toBeNull();
  });

  // The dummy-hash path must stay intact: an unknown client_id has to cost the same as a
  // known one, otherwise client ids are enumerable by timing.
  it('unknown client_id → null WITHOUT querying the tenant registry', async () => {
    const { svc, tenants } = make({ client: null });
    await expect(svc.validate('mc_nope', SECRET)).resolves.toBeNull();
    expect(tenants.get).not.toHaveBeenCalled();
  });

  it('the tenant lookup happens only after the secret is proven', async () => {
    const { svc, tenants } = make();
    await svc.validate('mc_abc', 'wrong');
    expect(tenants.get).not.toHaveBeenCalled();
  });
});
