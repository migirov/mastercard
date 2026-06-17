import { GatewayConfig } from '../../config/gateway-config';
import { loadPrivateKeyFromP12 } from '../../common/utils/p12.util';
import { PlatformCredentialsProvider } from './platform-credentials.provider';

jest.mock('../../common/utils/p12.util', () => ({
  loadPrivateKeyFromP12: jest.fn(() => 'PEM'),
}));

const configWith = (over: Record<string, string> = {}): GatewayConfig =>
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
  }) as unknown as GatewayConfig;

describe('PlatformCredentialsProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds platform McCredentials from config', () => {
    const creds = new PlatformCredentialsProvider(configWith()).get();
    expect(creds).toEqual({
      consumerKey: 'ck',
      signingKeyPem: 'PEM',
      partnerId: 'PID12345',
      encryptionFingerprint: 'fp',
    });
  });

  it('caches forever: the .p12 is parsed once across calls', () => {
    const p = new PlatformCredentialsProvider(configWith());
    p.get();
    p.get();
    expect(loadPrivateKeyFromP12).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit warms the cache (fail-fast at boot)', () => {
    const p = new PlatformCredentialsProvider(configWith());
    p.onModuleInit();
    expect(loadPrivateKeyFromP12).toHaveBeenCalledTimes(1);
    p.get(); // already warm → no second parse
    expect(loadPrivateKeyFromP12).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsafe platform partnerId', () => {
    const p = new PlatformCredentialsProvider(
      configWith({ partnerId: 'bad!' }),
    );
    expect(() => p.get()).toThrow(/invalid partnerId/);
  });
});
