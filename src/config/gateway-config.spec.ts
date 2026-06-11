import { GatewayConfig, MastercardModuleOptions } from './gateway-config';

const opts: MastercardModuleOptions = {
  baseUrl: 'https://sandbox.api.mastercard.com',
  consumerKey: 'consumer-key',
  partnerId: 'SANDBOX_1234567',
  jwtSecret: 'jwt-secret-1234567890',
  internalToken: 'internal-token',
  adminToken: 'admin-token',
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
    expect(
      new GatewayConfig({ ...opts, nodeEnv: 'production' }).isProduction,
    ).toBe(true);
    expect(
      new GatewayConfig({ ...opts, nodeEnv: 'development' }).isProduction,
    ).toBe(false);
  });
});
