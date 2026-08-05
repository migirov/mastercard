import { GatewayConfig } from '../../config/gateway-config';
import { loadSigningMaterialFromP12 } from '../../common/utils/p12.util';
import { PlatformCredentialsProvider } from './platform-credentials.provider';

jest.mock('../../common/utils/p12.util', () => ({
  loadSigningMaterialFromP12: jest.fn(() => ({
    privateKeyPem: 'PEM',
    certPem: 'CERT',
    certThumbprintS256: 'THUMB',
  })),
}));

const configWith = (
  over: Record<string, string> = {},
  extra: Partial<GatewayConfig> = {},
): GatewayConfig =>
  ({
    require: (k: string) =>
      ({
        signingKeyPath: '/signing.p12',
        signingKeyPassword: 'pw',
        consumerKey: 'ck',
        partnerId: 'PID12345',
        ...over,
      })[k],
    encryptionFingerprint: 'fp',
    ...extra,
  }) as unknown as GatewayConfig;

const certlessP12 = () =>
  (loadSigningMaterialFromP12 as jest.Mock).mockReturnValue({
    privateKeyPem: 'PEM',
  });

describe('PlatformCredentialsProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds platform McCredentials from config', () => {
    const creds = new PlatformCredentialsProvider(configWith()).get();
    expect(creds).toEqual({
      consumerKey: 'ck',
      signingKeyPem: 'PEM',
      partnerId: 'PID12345',
      encryptionFingerprint: 'fp',
      signingCertPem: 'CERT',
      signingCertThumbprintS256: 'THUMB',
    });
  });

  it('caches forever: the .p12 is parsed once across calls', () => {
    const p = new PlatformCredentialsProvider(configWith());
    p.get();
    p.get();
    expect(loadSigningMaterialFromP12).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit warms the cache (fail-fast at boot)', () => {
    const p = new PlatformCredentialsProvider(configWith());
    p.onModuleInit();
    expect(loadSigningMaterialFromP12).toHaveBeenCalledTimes(1);
    p.get(); // already warm → no second parse
    expect(loadSigningMaterialFromP12).toHaveBeenCalledTimes(1);
  });

  // The OAuth2 request token derives x5t#S256 from the signing certificate, so a
  // key-only .p12 in that mode cannot authenticate a single call. Fail at boot.
  it('refuses to start in oauth2 mode when the .p12 carries no certificate', () => {
    certlessP12();
    const p = new PlatformCredentialsProvider(
      configWith({}, { authMode: 'oauth2-request-token' }),
    );

    expect(() => p.onModuleInit()).toThrow(/requires the signing certificate/);
    // …and it must STAY broken: validating after caching would let a second call
    // hand back the unusable credentials with the guard silently gone.
    expect(() => p.get()).toThrow(/requires the signing certificate/);
  });

  it('accepts a key-only .p12 in oauth1 mode — the certificate is not used there', () => {
    certlessP12();
    const p = new PlatformCredentialsProvider(configWith());

    expect(() => p.get()).not.toThrow();
    expect(p.get().signingCertThumbprintS256).toBeUndefined();
  });

  it('rejects an unsafe platform partnerId', () => {
    const p = new PlatformCredentialsProvider(
      configWith({ partnerId: 'bad!' }),
    );
    expect(() => p.get()).toThrow(/invalid partnerId/);
  });
});
