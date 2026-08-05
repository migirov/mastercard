import { GatewayConfig, MastercardModuleOptions } from './gateway-config';

/**
 * The host and the auth mode must move together: the PSD2 edges reject OAuth 1.0a
 * with the same error as an unauthenticated call, and the `.com` endpoints do not
 * accept a request token. Catching the mismatch at startup turns "every payment
 * returns an opaque 502" into a boot failure with a readable message.
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

describe('GatewayConfig — auth mode / host consistency', () => {
  it('defaults to oauth1 on the .com endpoints', () => {
    expect(new GatewayConfig(opts({})).authMode).toBe('oauth1');
  });

  it('accepts oauth2-request-token on a PSD2 EU edge', () => {
    const c = new GatewayConfig(
      opts({
        baseUrl: 'https://sandbox.api.xbs.mastercard.eu',
        authMode: 'oauth2-request-token',
      }),
    );
    expect(c.authMode).toBe('oauth2-request-token');
  });

  it('accepts oauth2-request-token on a PSD2 UK edge', () => {
    expect(
      new GatewayConfig(
        opts({
          // Sandbox, not MTF: the MTF/production edges additionally require an
          // mTLS client certificate (see mtls-host.spec.ts), which is a separate
          // pairing and would fail this one for an unrelated reason.
          baseUrl: 'https://sandbox.api.xbs.mastercard.uk',
          authMode: 'oauth2-request-token',
        }),
      ).authMode,
    ).toBe('oauth2-request-token');
  });

  it('refuses a PSD2 edge left on oauth1', () => {
    expect(
      () =>
        new GatewayConfig(
          opts({ baseUrl: 'https://sandbox.api.xbs.mastercard.eu' }),
        ),
    ).toThrow(/PSD2 edge, which requires MC_AUTH_MODE=oauth2-request-token/);
  });

  it('refuses a .com endpoint switched to oauth2-request-token', () => {
    expect(
      () => new GatewayConfig(opts({ authMode: 'oauth2-request-token' })),
    ).toThrow(/only accepted by the PSD2 edges/);
  });

  it('does not mistake the dead legacy sandbox.api.mastercard.eu for a PSD2 edge', () => {
    // That host (no `xbs`) is a decommissioned edge whose TLS cert expired in 2024;
    // it must not silently satisfy the PSD2 pairing.
    expect(
      () =>
        new GatewayConfig(
          opts({
            baseUrl: 'https://sandbox.api.mastercard.eu',
            authMode: 'oauth2-request-token',
          }),
        ),
    ).toThrow(/only accepted by the PSD2 edges/);
  });

  it('rejects a malformed baseUrl with a readable message', () => {
    expect(() => new GatewayConfig(opts({ baseUrl: 'not-a-url' }))).toThrow(
      /'baseUrl' is not a valid URL/,
    );
  });
});
