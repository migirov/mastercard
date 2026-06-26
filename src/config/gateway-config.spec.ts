import { GatewayConfig, MastercardModuleOptions } from './gateway-config';

const opts: MastercardModuleOptions = {
  baseUrl: 'https://sandbox.api.mastercard.com',
  consumerKey: 'consumer-key',
  partnerId: 'SANDBOX_1234567',
  jwtSecret: 'jwt-secret-1234567890',
  internalToken: 'internal-token',
  adminToken: 'admin-token',
};

// Strong secrets + the AWS store + in-app webhook mTLS — to pass the prod gates.
const prod: Partial<MastercardModuleOptions> = {
  nodeEnv: 'production',
  jwtSecret: 'x'.repeat(32),
  internalToken: 'y'.repeat(32),
  adminToken: 'z'.repeat(32),
  webhookToken: 'w'.repeat(32),
  secretStore: 'aws-secrets-manager',
  webhookMtlsEnabled: true,
  webhookAllowedClientCNs: [
    'CrossborderServicesNotification-prod.mastercard.com',
  ],
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

  it('requires the AWS Secrets Manager store in production', () => {
    expect(
      () => new GatewayConfig({ ...opts, ...prod, secretStore: 'local' }),
    ).toThrow(/aws-secrets-manager/);
  });

  it('accepts a fully valid production config (positive control)', () => {
    // The accept-boundary: without this, a bug making the prod gate throw unconditionally
    // would still pass every "rejects ..." test below.
    expect(() => new GatewayConfig({ ...opts, ...prod })).not.toThrow();
  });

  it('requires in-app webhook mTLS in production', () => {
    expect(
      () => new GatewayConfig({ ...opts, ...prod, webhookMtlsEnabled: false }),
    ).toThrow(/mtls/i);
    expect(
      () =>
        new GatewayConfig({ ...opts, ...prod, webhookAllowedClientCNs: [] }),
    ).toThrow(/mtls/i);
  });

  it('treats webhookToken as optional in production (mTLS is the factor)', () => {
    // no webhookToken at all → still valid because in-app mTLS is configured
    const { webhookToken, ...noToken } = prod;
    void webhookToken;
    expect(() => new GatewayConfig({ ...opts, ...noToken })).not.toThrow();
  });
});
