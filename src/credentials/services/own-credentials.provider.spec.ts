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

function make(getMerchantSecrets = jest.fn(async () => bundle)) {
  const secrets = { getMerchantSecrets } as unknown as SecretStore;
  const config = { credsCacheTtlMs: 600_000 } as GatewayConfig;
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
