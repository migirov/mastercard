import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from './encryption.service';

// Mock the JWE library: this spec is about the service logic (toggle, fail-loud
// guard, passthrough, fingerprint validation), not the real crypto/files.
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

const platformCreds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'P',
} as McCredentials;
const ownCreds = {
  ...platformCreds,
  encryptionCertPem: 'CERT',
} as McCredentials;

const disabledConfig = { encryptionEnabled: false } as GatewayConfig;
const enabledConfig = (fingerprint = 'a'.repeat(64)) =>
  ({
    encryptionEnabled: true,
    require: (k: string) =>
      k === 'encryptionFingerprint' ? fingerprint : `/x/${k}`,
  }) as unknown as GatewayConfig;

describe('EncryptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('disabled (sandbox)', () => {
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

  describe('enabled (MTF/Prod)', () => {
    let svc: EncryptionService;
    beforeEach(() => {
      svc = new EncryptionService(enabledConfig());
      svc.onModuleInit();
    });

    it('encrypts a PLATFORM-tenant request with the platform key', () => {
      const out = svc.encryptRequest(platformCreds, { a: 1 });
      expect(out.encrypted).toBe(true);
      expect(encryptMock).toHaveBeenCalledTimes(1);
    });

    it('FAILS LOUD: refuses to encrypt an OWN tenant with the platform key', () => {
      expect(() => svc.encryptRequest(ownCreds, { a: 1 })).toThrow(
        /Per-tenant encryption is not implemented/,
      );
      expect(encryptMock).not.toHaveBeenCalled();
    });

    it('FAILS LOUD: refuses to decrypt an OWN-tenant response with the platform key', () => {
      expect(() =>
        svc.decryptResponse(ownCreds, { encrypted_payload: { data: 'x' } }),
      ).toThrow(/Per-tenant encryption is not implemented/);
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it('decryptResponse passes through a plain (non-enveloped) body', () => {
      const body = { plain: true };
      expect(svc.decryptResponse(platformCreds, body)).toBe(body);
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it('decrypts an enveloped PLATFORM response', () => {
      svc.decryptResponse(platformCreds, { encrypted_payload: { data: 'x' } });
      expect(decryptMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('fingerprint validation', () => {
    it('rejects a non-64-hex fingerprint (e.g. colon cert form) at init', () => {
      const svc = new EncryptionService(enabledConfig('AB:CD:EF'));
      expect(() => svc.onModuleInit()).toThrow(/64-hex/);
    });
  });
});
