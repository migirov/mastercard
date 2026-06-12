import { GatewayConfig, MastercardModuleOptions } from './gateway-config';

const opts: MastercardModuleOptions = {
  baseUrl: 'https://sandbox.api.mastercard.com',
  consumerKey: 'consumer-key',
  partnerId: 'SANDBOX_1234567',
  jwtSecret: 'jwt-secret-1234567890',
  internalToken: 'internal-token',
  adminToken: 'admin-token',
};

// Сильные секреты + vault — чтобы пройти прод-гейты конструктора GatewayConfig.
const prod: Partial<MastercardModuleOptions> = {
  nodeEnv: 'production',
  jwtSecret: 'x'.repeat(32),
  internalToken: 'y'.repeat(32),
  adminToken: 'z'.repeat(32),
  webhookToken: 'w'.repeat(32),
  secretStore: 'vault',
};

describe('GatewayConfig', () => {
  it('exposes options via typed getters', () => {
    const c = new GatewayConfig(opts);
    expect(c.baseUrl).toBe(opts.baseUrl);
    expect(c.consumerKey).toBe(opts.consumerKey);
    expect(c.partnerId).toBe(opts.partnerId);
    expect(c.jwtSecret).toBe(opts.jwtSecret);
    expect(c.internalToken).toBe(opts.internalToken);
    expect(c.adminToken).toBe(opts.adminToken);
  });

  it('applies sensible defaults', () => {
    const c = new GatewayConfig(opts);
    expect(c.encryptionEnabled).toBe(false);
    expect(c.secretStore).toBe('local');
    expect(c.credsCacheTtlMs).toBeGreaterThan(0);
    expect(c.webhookToken).toBeUndefined();
  });

  it('require() throws for a missing optional key', () => {
    const c = new GatewayConfig(opts);
    expect(() => c.require('encryptionCertPath')).toThrow(/encryptionCertPath/);
  });

  it('require() returns a set value', () => {
    const c = new GatewayConfig({ ...opts, decryptionKeyPath: '/certs/k.pem' });
    expect(c.require('decryptionKeyPath')).toBe('/certs/k.pem');
  });

  it('isProduction reflects the nodeEnv option', () => {
    expect(new GatewayConfig({ ...opts, ...prod }).isProduction).toBe(true);
    expect(
      new GatewayConfig({ ...opts, nodeEnv: 'development' }).isProduction,
    ).toBe(false);
  });

  it('throws when a required option is missing', () => {
    expect(() => new GatewayConfig({ ...opts, baseUrl: '' })).toThrow(
      /baseUrl/,
    );
    expect(() => new GatewayConfig({ ...opts, jwtSecret: '' })).toThrow(
      /jwtSecret/,
    );
  });

  it('rejects weak secrets in production', () => {
    // base opts have short (dev) secrets → must fail the prod gate
    expect(
      () => new GatewayConfig({ ...opts, ...prod, jwtSecret: 'short' }),
    ).toThrow(/weak\/default/);
  });

  it('requires vault secret store in production', () => {
    expect(
      () => new GatewayConfig({ ...opts, ...prod, secretStore: 'local' }),
    ).toThrow(/vault/);
  });
});
