import { JweEncryption } from 'mastercard-client-encryption';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from './encryption.service';

// Mock the JWE library: this spec covers the service logic (toggle, PLATFORM vs
// per-tenant key selection, the per-tenant build/cache, passthrough, fingerprint
// validation), not the real crypto/files. The constructor mock is created INSIDE
// the factory (out-of-scope `encryptMock`/`decryptMock` are referenced only inside
// the lazy implementation, so there is no TDZ when the factory runs).
const encryptMock = jest.fn(() => ({
  body: { encrypted_payload: { data: 'JWE' } },
}));
const decryptMock = jest.fn(() => ({ decrypted: true }));
jest.mock('mastercard-client-encryption', () => ({
  JweEncryption: jest.fn().mockImplementation(() => ({
    encrypt: encryptMock,
    decrypt: decryptMock,
  })),
}));
const jweCtor = JweEncryption as unknown as jest.Mock;

const platformCreds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'P',
} as McCredentials;
// A complete OWN tenant: its own cert + fingerprint + decryption key.
const ownCreds = {
  ...platformCreds,
  encryptionCertPem: 'OWN_CERT',
  encryptionFingerprint: 'b'.repeat(64),
  decryptionKeyPem: 'OWN_KEY',
} as McCredentials;
// An OWN tenant missing part of its key material.
const ownIncomplete = {
  ...platformCreds,
  encryptionCertPem: 'OWN_CERT',
} as McCredentials;

// A JWE compact serialization with a cleartext base64url JOSE header (optionally a kid),
// wrapped in the MC push envelope. The body is dummy — the JWE library is mocked.
const makeJwe = (kid?: string) => {
  const header = Buffer.from(
    JSON.stringify(
      kid
        ? { alg: 'RSA-OAEP-256', enc: 'A256GCM', kid }
        : { alg: 'RSA-OAEP-256', enc: 'A256GCM' },
    ),
  ).toString('base64url');
  return `${header}.encryptedKey.iv.ciphertext.tag`;
};
const pushEnvelope = (kid?: string) => ({
  encrypted_payload: { data: makeJwe(kid) },
});

const disabledConfig = { encryptionEnabled: false } as GatewayConfig;
const enabledConfig = (fingerprint = 'a'.repeat(64)) =>
  ({
    encryptionEnabled: true,
    require: (k: string) =>
      k === 'encryptionFingerprint' ? fingerprint : `/x/${k}`,
  }) as unknown as GatewayConfig;

describe('EncryptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('disabled (no keys configured)', () => {
    const svc = new EncryptionService(disabledConfig);
    svc.onModuleInit();

    it('encryptRequest passes the body through untouched', () => {
      expect(svc.encryptRequest(ownCreds, { a: 1 })).toEqual({
        body: { a: 1 },
        encrypted: false,
      });
      expect(encryptMock).not.toHaveBeenCalled();
    });

    it('decryptResponse passes the body through untouched', () => {
      const body = { encrypted_payload: { data: 'x' } };
      expect(svc.decryptResponse(ownCreds, body)).toBe(body);
      expect(decryptMock).not.toHaveBeenCalled();
    });
  });

  describe('enabled — PLATFORM tenant (shared key)', () => {
    let svc: EncryptionService;
    beforeEach(() => {
      svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
    });

    it('builds the platform JWE from config FILE PATHS at init', () => {
      expect(jweCtor).toHaveBeenCalledTimes(1);
      expect(jweCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          useCertificateContent: false,
          publicKeyFingerprint: 'a'.repeat(64),
        }),
      );
    });

    it('encrypts a PLATFORM request with the platform key (no rebuild)', () => {
      const out = svc.encryptRequest(platformCreds, { a: 1 });
      expect(out.encrypted).toBe(true);
      expect(encryptMock).toHaveBeenCalledTimes(1);
      expect(jweCtor).toHaveBeenCalledTimes(1); // reused the platform instance
    });

    it('decrypts an enveloped PLATFORM response', () => {
      svc.decryptResponse(platformCreds, { encrypted_payload: { data: 'x' } });
      expect(decryptMock).toHaveBeenCalledTimes(1);
    });

    it('passes through a plain (non-enveloped) response', () => {
      const body = { plain: true };
      expect(svc.decryptResponse(platformCreds, body)).toBe(body);
      expect(decryptMock).not.toHaveBeenCalled();
    });
  });

  describe('enabled — OWN tenant (per-tenant key)', () => {
    let svc: EncryptionService;
    beforeEach(() => {
      svc = new EncryptionService(enabledConfig());
      svc.onModuleInit(); // 1 platform JWE built
    });

    it('encrypts an OWN request with a per-tenant JWE built from PEM content', () => {
      const out = svc.encryptRequest(ownCreds, { a: 1 });
      expect(out.encrypted).toBe(true);
      expect(encryptMock).toHaveBeenCalledTimes(1);
      // a second JWE was built from the OWN PEM content (not file paths)
      expect(jweCtor).toHaveBeenCalledTimes(2);
      expect(jweCtor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          useCertificateContent: true,
          encryptionCertificate: 'OWN_CERT',
          privateKey: 'OWN_KEY',
          publicKeyFingerprint: 'b'.repeat(64),
        }),
      );
    });

    it('decrypts an OWN response with the per-tenant key', () => {
      svc.decryptResponse(ownCreds, { encrypted_payload: { data: 'x' } });
      expect(decryptMock).toHaveBeenCalledTimes(1);
    });

    it('caches the per-tenant JWE by fingerprint (built once for repeat calls)', () => {
      svc.encryptRequest(ownCreds, { a: 1 });
      svc.encryptRequest(ownCreds, { a: 2 });
      svc.decryptResponse(ownCreds, { encrypted_payload: { data: 'x' } });
      expect(jweCtor).toHaveBeenCalledTimes(2); // 1 platform + 1 OWN (cached)
    });

    it('FAILS LOUD: an OWN tenant with incomplete keys is refused', () => {
      expect(() => svc.encryptRequest(ownIncomplete, { a: 1 })).toThrow(
        /incomplete encryption keys/,
      );
      expect(encryptMock).not.toHaveBeenCalled();
    });
  });

  describe('fingerprint validation', () => {
    it('rejects a non-64-hex platform fingerprint at init', () => {
      const svc = new EncryptionService(enabledConfig('AB:CD:EF'));
      expect(() => svc.onModuleInit()).toThrow(/64-hex/);
    });
  });

  describe('decryptPush — route by JWE kid', () => {
    it('returns undefined when FLE is disabled', () => {
      const svc = new EncryptionService(disabledConfig);
      svc.onModuleInit();
      expect(svc.decryptPush(pushEnvelope('a'.repeat(64)))).toBeUndefined();
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it('returns undefined for a non-enveloped body', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      expect(svc.decryptPush({ plain: true })).toBeUndefined();
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it('decrypts with the platform key when the kid is the platform fingerprint', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      expect(svc.decryptPush(pushEnvelope('a'.repeat(64)))).toEqual({
        decrypted: true,
      });
      expect(decryptMock).toHaveBeenCalledTimes(1);
      expect(jweCtor).toHaveBeenCalledTimes(1); // reused the platform JWE
    });

    it('decrypts with the platform key when there is no kid', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      expect(svc.decryptPush(pushEnvelope())).toEqual({ decrypted: true });
      expect(decryptMock).toHaveBeenCalledTimes(1);
    });

    it('decrypts with the per-tenant key when its kid is cached from prior activity', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      svc.encryptRequest(ownCreds, { a: 1 }); // builds + caches the OWN JWE (kid b*64)
      expect(svc.decryptPush(pushEnvelope('b'.repeat(64)))).toEqual({
        decrypted: true,
      });
      expect(decryptMock).toHaveBeenCalledTimes(1);
      expect(jweCtor).toHaveBeenCalledTimes(2); // platform + OWN (reused, not rebuilt)
    });

    it('returns undefined for an OWN kid whose key is not cached yet', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      expect(svc.decryptPush(pushEnvelope('c'.repeat(64)))).toBeUndefined();
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it('returns undefined (no throw) when decryption fails', () => {
      const svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
      decryptMock.mockImplementationOnce(() => {
        throw new Error('bad key');
      });
      expect(svc.decryptPush(pushEnvelope('a'.repeat(64)))).toBeUndefined();
    });
  });
});
