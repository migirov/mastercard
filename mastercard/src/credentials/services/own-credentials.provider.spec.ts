import { UnprocessableEntityException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import {
  MerchantSecretBundle,
  SecretStore,
} from '../../secrets/secret-store.types';
import { CredentialMode, Tenant } from '../../tenants/tenant.types';
import { OwnCredentialsProvider } from './own-credentials.provider';

// p12 decode is stubbed — this spec is about fetch/validation, not forge.
jest.mock('../../common/utils/p12.util', () => ({
  loadPrivateKeyFromP12: jest.fn(() => 'PEM'),
  loadPrivateKeyFromP12Base64: jest.fn(() => 'PEM'),
}));

const bundle: MerchantSecretBundle = {
  consumerKey: 'ck',
  partnerId: 'PID12345',
  signing: { p12Base64: 'AAAA' },
} as MerchantSecretBundle;

const ownTenant = (id: string, over?: Partial<Tenant>): Tenant =>
  ({
    id,
    credentialMode: CredentialMode.OWN,
    secretRef: `mc/tenants/${id}`,
    ...over,
  }) as unknown as Tenant;

function make(
  getMerchantSecrets = jest.fn(async () => bundle),
  configOver?: Partial<GatewayConfig>,
) {
  const secrets = { getMerchantSecrets } as unknown as SecretStore;
  const config = { credsCacheTtlMs: 600_000, ...configOver } as GatewayConfig;
  return { provider: new OwnCredentialsProvider(config, secrets) };
}

describe('OwnCredentialsProvider — fetch & boundary validation', () => {
  it('resolves an OWN bundle into McCredentials', async () => {
    const { provider } = make();
    const creds = await provider.get(ownTenant('acme'));
    expect(creds).toMatchObject({
      consumerKey: 'ck',
      partnerId: 'PID12345',
      signingKeyPem: 'PEM',
    });
  });

  it('an explicit tenant partnerId wins over the bundle', async () => {
    const { provider } = make();
    const creds = await provider.get(
      ownTenant('acme', { partnerId: 'OVERRIDE_1' } as Partial<Tenant>),
    );
    expect(creds.partnerId).toBe('OVERRIDE_1');
  });

  // Caching is delegated to cache-manager; these two tests cover OUR wiring of it
  // (wrap on get, del on invalidate) rather than the library's TTL/LRU internals.
  it('caches a resolved tenant: a second get → one SecretStore fetch', async () => {
    const fetchSecrets = jest.fn(async () => bundle);
    const { provider } = make(fetchSecrets);
    await provider.get(ownTenant('acme'));
    await provider.get(ownTenant('acme'));
    expect(fetchSecrets).toHaveBeenCalledTimes(1);
  });

  it('invalidate forces a re-fetch on the next get', async () => {
    const fetchSecrets = jest.fn(async () => bundle);
    const { provider } = make(fetchSecrets);
    const t = ownTenant('acme');
    await provider.get(t);
    provider.invalidate(t.id);
    await new Promise((r) => setImmediate(r)); // let the async del settle
    await provider.get(t);
    expect(fetchSecrets).toHaveBeenCalledTimes(2);
  });

  it('a rejected resolve is not cached (next get re-fetches)', async () => {
    const fetchSecrets = jest
      .fn()
      .mockRejectedValueOnce(new Error('secret store down'))
      .mockResolvedValue(bundle);
    const { provider } = make(fetchSecrets as never);
    await expect(provider.get(ownTenant('acme'))).rejects.toThrow();
    await expect(provider.get(ownTenant('acme'))).resolves.toMatchObject({
      consumerKey: 'ck',
    });
    expect(fetchSecrets).toHaveBeenCalledTimes(2);
  });

  it('partnerId outside the allowlist → rejected', async () => {
    const { provider } = make();
    await expect(
      provider.get(ownTenant('a', { partnerId: 'bad id!' } as Partial<Tenant>)),
    ).rejects.toThrow(/invalid partnerId/);
  });

  it('secretRef with ".." → rejected (anti-traversal)', async () => {
    const { provider } = make();
    await expect(
      provider.get(
        ownTenant('a', { secretRef: 'mc/../platform' } as Partial<Tenant>),
      ),
    ).rejects.toThrow(/invalid secretRef/);
  });

  it('bundle without consumerKey → validation rejected', async () => {
    const { provider } = make(
      jest.fn(async () => ({ ...bundle, consumerKey: '' })) as never,
    );
    await expect(provider.get(ownTenant('a'))).rejects.toThrow(/consumerKey/);
  });

  it('bundle without signing → validation rejected', async () => {
    const { provider } = make(
      jest.fn(async () => ({ ...bundle, signing: undefined })) as never,
    );
    await expect(provider.get(ownTenant('a'))).rejects.toThrow(/signing/);
  });

  // Isolation invariant: an OWN tenant must never resolve onto the platform's own Mastercard
  // identity (e.g. a secretRef pointed at the dev-seeded platform bundle). The gate is a no-op
  // for OWN tenants because MC isolates them by their own partnerId — so a collapse onto the
  // platform's consumerKey/partnerId would sign as the platform while being treated as isolated.
  it('OWN resolving to the PLATFORM consumerKey → rejected', async () => {
    const { provider } = make(undefined, {
      consumerKey: 'ck',
    } as Partial<GatewayConfig>);
    await expect(provider.get(ownTenant('a'))).rejects.toThrow(/misconfigured/);
  });

  it('OWN resolving to the PLATFORM partnerId → rejected', async () => {
    const { provider } = make(undefined, {
      partnerId: 'PID12345',
    } as Partial<GatewayConfig>);
    await expect(provider.get(ownTenant('a'))).rejects.toThrow(/misconfigured/);
  });

  it('OWN without secretRef → rejected', async () => {
    const { provider } = make();
    await expect(
      provider.get(ownTenant('a', { secretRef: undefined } as Partial<Tenant>)),
    ).rejects.toThrow(/not configured/);
  });

  // Status contract: a resolution failure is a 422 (tenant not configured), NOT a
  // raw Error → 500 (alerting panic).
  it('resolution failures are UnprocessableEntity (422), not 500', async () => {
    const { provider } = make();
    await expect(
      provider.get(ownTenant('a', { partnerId: 'bad id!' } as Partial<Tenant>)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      provider.get(
        ownTenant('b', { secretRef: 'mc/../platform' } as Partial<Tenant>),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
