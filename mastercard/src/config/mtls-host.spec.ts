import { GatewayConfig, MastercardModuleOptions } from './gateway-config';

/**
 * Mastercard requires a client certificate on the MTF and production PSD2 edges but
 * NOT on the sandbox one ("For Sandbox EU/UK domain testing, mTLS certificate is not
 * needed"). Booting an MTF/production host without it makes every call fail at the
 * TLS handshake and surface as an opaque 502, so the pairing is checked at startup.
 *
 * The rule is derived from the HOSTNAME, not NODE_ENV: a production gate would demand
 * a certificate on a `.com` production deployment (where MC does not want one) and
 * would not fire on MTF, which is where it first becomes mandatory.
 */

const opts = (
  over: Partial<MastercardModuleOptions>,
): MastercardModuleOptions =>
  ({
    baseUrl: 'https://sandbox.api.mastercard.com',
    consumerKey: 'ck',
    partnerId: 'PID12345',
    jwtSecret: 'x'.repeat(32),
    internalToken: 'y'.repeat(32),
    adminToken: 'z'.repeat(32),
    ...over,
  }) as MastercardModuleOptions;

/** A PSD2 host always needs the matching auth mode; fold it in to isolate mTLS. */
const psd2 = (host: string, over: Partial<MastercardModuleOptions> = {}) =>
  opts({
    baseUrl: `https://${host}`,
    authMode: 'oauth2-request-token',
    ...over,
  });

describe('GatewayConfig — outbound mTLS / host pairing', () => {
  it('sandbox PSD2 edge boots without a client certificate', () => {
    const c = new GatewayConfig(psd2('sandbox.api.xbs.mastercard.eu'));

    expect(c.mtlsRequiredForHost).toBe(false);
    expect(c.mtlsEnabled).toBe(false);
  });

  it('refuses MTF without mTLS', () => {
    expect(() => new GatewayConfig(psd2('mtf.api.xbs.mastercard.eu'))).toThrow(
      /requires outbound mTLS/,
    );
  });

  it('refuses production without mTLS, EU and UK alike', () => {
    for (const host of ['api.xbs.mastercard.eu', 'api.xbs.mastercard.uk']) {
      expect(() => new GatewayConfig(psd2(host))).toThrow(
        /requires outbound mTLS/,
      );
    }
  });

  it('accepts MTF once mTLS is enabled', () => {
    const c = new GatewayConfig(
      psd2('mtf.api.xbs.mastercard.uk', {
        mtlsEnabled: true,
        mtlsClientCertPath: '/certs/mc-mtls.p12',
        mtlsClientCertPassword: 'pw',
      }),
    );

    expect(c.mtlsRequiredForHost).toBe(true);
    expect(c.mtlsEnabled).toBe(true);
  });

  it('never demands mTLS on the global endpoints — MC does not want it there', () => {
    for (const host of ['sandbox.api.mastercard.com', 'api.mastercard.com']) {
      const c = new GatewayConfig(opts({ baseUrl: `https://${host}` }));
      expect(c.mtlsRequiredForHost).toBe(false);
    }
  });

  it('does not treat the decommissioned sandbox.api.mastercard.eu as a PSD2 edge', () => {
    // No `xbs` segment: a dead legacy host whose certificate expired in 2024. It must
    // not silently satisfy either pairing.
    const c = new GatewayConfig(
      opts({ baseUrl: 'https://sandbox.api.mastercard.eu' }),
    );
    expect(c.mtlsRequiredForHost).toBe(false);
  });
});
