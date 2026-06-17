import { UnprocessableEntityException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import {
  MerchantSecretBundle,
  SecretStore,
} from '../../secrets/secret-store.types';
import { CredentialMode, Tenant } from '../../tenants/tenant.types';
import { CredentialsService } from './credentials.service';

// p12-декод заменяем заглушкой — спек про кэш/валидацию, не про forge.
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
  const svc = new CredentialsService(config, secrets);
  return { svc, getMerchantSecrets };
}

describe('CredentialsService — OWN cache', () => {
  it('stampede: одновременные resolve одного тенанта → один fetch', async () => {
    const { svc, getMerchantSecrets } = make();
    const t = ownTenant('acme');
    await Promise.all([svc.resolve(t), svc.resolve(t), svc.resolve(t)]);
    expect(getMerchantSecrets).toHaveBeenCalledTimes(1);
  });

  it('LRU: кэш не растёт сверх потолка (OWN_CACHE_MAX=500)', async () => {
    const { svc } = make();
    for (let i = 0; i < 600; i++) await svc.resolve(ownTenant(`t${i}`));
    const cache = svc['ownCache'] as Map<string, unknown>;
    expect(cache.size).toBeLessThanOrEqual(500);
    // самый старый (t0) вытеснен, свежий (t599) на месте
    expect(cache.has('t0')).toBe(false);
    expect(cache.has('t599')).toBe(true);
  });

  it('rejected fetch выселяется из кэша (не залипает на TTL)', async () => {
    const fail = jest.fn().mockRejectedValueOnce(new Error('vault down'));
    const { svc } = make(fail as never);
    await expect(svc.resolve(ownTenant('x'))).rejects.toThrow();
    const cache = svc['ownCache'] as Map<string, unknown>;
    expect(cache.has('x')).toBe(false);
  });
});

describe('CredentialsService — boundary validation', () => {
  it('partnerId вне allowlist → отказ', async () => {
    const { svc } = make();
    await expect(
      svc.resolve(ownTenant('a', { partnerId: 'bad id!' } as Partial<Tenant>)),
    ).rejects.toThrow(/invalid partnerId/);
  });

  it('secretRef с ".." → отказ (анти-traversal)', async () => {
    const { svc } = make();
    await expect(
      svc.resolve(
        ownTenant('a', { secretRef: 'mc/../platform' } as Partial<Tenant>),
      ),
    ).rejects.toThrow(/invalid secretRef/);
  });

  it('бандл без consumerKey → отказ валидации', async () => {
    const { svc } = make(
      jest.fn(async () => ({ ...bundle, consumerKey: '' })) as never,
    );
    await expect(svc.resolve(ownTenant('a'))).rejects.toThrow(/consumerKey/);
  });

  it('бандл без signing → отказ валидации (missing signing key material)', async () => {
    const { svc } = make(
      jest.fn(async () => ({ ...bundle, signing: undefined })) as never,
    );
    await expect(svc.resolve(ownTenant('a'))).rejects.toThrow(/signing/);
  });

  it('OWN без secretRef → отказ', async () => {
    const { svc } = make();
    await expect(
      svc.resolve(ownTenant('a', { secretRef: undefined } as Partial<Tenant>)),
    ).rejects.toThrow(/not configured/);
  });

  // Контракт статуса: провал резолва — это 422 (тенант не сконфигурирован), а НЕ
  // сырой Error → 500 (паника алертинга). Это и есть смысл недавней правки.
  it('провалы резолва — это UnprocessableEntity (422), а не 500', async () => {
    const { svc } = make();
    await expect(
      svc.resolve(ownTenant('a', { partnerId: 'bad id!' } as Partial<Tenant>)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      svc.resolve(
        ownTenant('b', { secretRef: 'mc/../platform' } as Partial<Tenant>),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
