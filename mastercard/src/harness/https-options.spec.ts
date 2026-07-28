import { MIN_TLS_VERSION } from '../common/utils/tls';
import { httpsOptionsFromEnv } from './https-options';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn((p: string) => Buffer.from(`<${p}>`)),
}));

const env = (o: Record<string, string | undefined>) =>
  o as unknown as NodeJS.ProcessEnv;

describe('harness https options', () => {
  afterEach(() => jest.clearAllMocks());

  it('is disabled unless BOTH key and cert are configured', () => {
    expect(httpsOptionsFromEnv(env({}))).toBeUndefined();
    expect(httpsOptionsFromEnv(env({ TLS_KEY_PATH: 'k' }))).toBeUndefined();
    expect(httpsOptionsFromEnv(env({ TLS_CERT_PATH: 'c' }))).toBeUndefined();
  });

  it('pins the TLS floor on the inbound listener, matching the outbound agent', () => {
    const o = httpsOptionsFromEnv(
      env({ TLS_KEY_PATH: 'k', TLS_CERT_PATH: 'c' }),
    );
    // The listener must not accept a protocol version the outbound client refuses to speak;
    // both read the same constant so they cannot drift apart.
    expect(o?.minVersion).toBe(MIN_TLS_VERSION);
    expect(MIN_TLS_VERSION).toBe('TLSv1.2');
  });

  it('asks for a client cert but does not reject at the TLS layer', () => {
    const o = httpsOptionsFromEnv(
      env({ TLS_KEY_PATH: 'k', TLS_CERT_PATH: 'c' }),
    );
    // requestCert so WebhookAuthGuard can see MC's certificate; rejectUnauthorized:false so
    // partner traffic, which presents no client cert, still reaches the API. The guard — not
    // the socket — enforces the certificate, and only on the webhook route.
    expect(o?.requestCert).toBe(true);
    expect(o?.rejectUnauthorized).toBe(false);
  });

  it('loads the client CA bundle only when one is configured', () => {
    const withCa = httpsOptionsFromEnv(
      env({ TLS_KEY_PATH: 'k', TLS_CERT_PATH: 'c', TLS_CLIENT_CA_PATH: 'ca' }),
    );
    expect(withCa?.ca).toEqual(Buffer.from('<ca>'));

    const withoutCa = httpsOptionsFromEnv(
      env({ TLS_KEY_PATH: 'k', TLS_CERT_PATH: 'c' }),
    );
    expect(withoutCa?.ca).toBeUndefined();
  });
});
