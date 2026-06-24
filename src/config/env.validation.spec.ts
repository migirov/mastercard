import { validateEnv } from './env.validation';

/** Minimal config that satisfies every required variable. */
const validEnv = (): Record<string, unknown> => ({
  MC_BASE_URL: 'https://sandbox.api.mastercard.com',
  MC_CONSUMER_KEY: 'consumer-key',
  MC_PARTNER_ID: 'partner-id',
  MC_SIGNING_KEY_PATH: '/secrets/signing.p12',
  MC_SIGNING_KEY_PASSWORD: 'pw',
  DATABASE_URL: 'postgres://mc:mc@localhost:5432/mc_gateway',
  MC_JWT_SECRET: 'x'.repeat(16),
  MC_INTERNAL_TOKEN: 'internal-token',
  MC_ADMIN_TOKEN: 'admin-token',
});

describe('validateEnv (zod)', () => {
  it('accepts a valid config and returns it unchanged', () => {
    const env = validEnv();
    expect(validateEnv(env)).toBe(env);
  });

  it('preserves variables not declared in the schema (NODE_ENV, PORT, …)', () => {
    const env = { ...validEnv(), NODE_ENV: 'production', PORT: '3000' };
    const out = validateEnv(env);
    expect(out.NODE_ENV).toBe('production');
    expect(out.PORT).toBe('3000');
  });

  it.each([
    'MC_BASE_URL',
    'MC_CONSUMER_KEY',
    'MC_PARTNER_ID',
    'MC_SIGNING_KEY_PATH',
    'MC_SIGNING_KEY_PASSWORD',
    'DATABASE_URL',
    'MC_JWT_SECRET',
    'MC_INTERNAL_TOKEN',
    'MC_ADMIN_TOKEN',
  ])('throws when required %s is missing (and names it)', (key) => {
    const env = validEnv();
    delete env[key];
    expect(() => validateEnv(env)).toThrow(
      new RegExp(`Invalid \\.env configuration:.*${key}`),
    );
  });

  it('rejects an empty required string', () => {
    expect(() => validateEnv({ ...validEnv(), MC_ADMIN_TOKEN: '' })).toThrow(
      /MC_ADMIN_TOKEN/,
    );
  });

  it('rejects MC_JWT_SECRET shorter than 16 chars', () => {
    expect(() =>
      validateEnv({ ...validEnv(), MC_JWT_SECRET: 'x'.repeat(15) }),
    ).toThrow(/MC_JWT_SECRET/);
  });

  it('accepts valid optional/defaulted vars', () => {
    const env = {
      ...validEnv(),
      MC_ENCRYPTION_ENABLED: 'true',
      MC_SECRET_STORE: 'aws-secrets-manager',
      MC_SECRET_STORE_REGION: 'us-east-1',
      DB_POOL_MAX: '10',
      MC_WEBHOOK_TOKEN: 'wh',
      MC_WEBHOOK_MTLS_ENABLED: 'true',
      MC_WEBHOOK_ALLOWED_CLIENT_CNS:
        'CrossborderServicesNotification-prod.mastercard.com',
      TLS_KEY_PATH: '/certs/server.key',
      TLS_CERT_PATH: '/certs/server.crt',
      TLS_CLIENT_CA_PATH: '/certs/digicert-ca.pem',
    };
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('accepts an absent or empty-string optional', () => {
    expect(() => validateEnv(validEnv())).not.toThrow(); // omitted entirely
    expect(() =>
      validateEnv({ ...validEnv(), MC_WEBHOOK_TOKEN: '' }),
    ).not.toThrow();
  });

  it.each([
    ['MC_SECRET_STORE', 'redis'],
    ['MC_ENCRYPTION_ENABLED', 'yes'],
    ['DB_POOL_MAX', 'lots'],
    ['DB_POOL_MAX', '-5'], // sign / float rejected (must be a positive integer)
    ['DB_POOL_MAX', '3.5'],
  ])('rejects an invalid value for %s', (key, value) => {
    expect(() => validateEnv({ ...validEnv(), [key]: value })).toThrow(
      new RegExp(key),
    );
  });
});
