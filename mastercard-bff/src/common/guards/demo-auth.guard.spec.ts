import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { McConfig } from '../../config/mc-config';
import { signGateProof } from '../utils/gate-proof.util';
import {
  DemoAuthGuard,
  GATE_EXEMPT_PATHS,
  PUBLIC_PATHS,
} from './demo-auth.guard';

const TOKEN = 's3cret-token-value';
const SECRET = 'gate-session-secret-value';

function make(
  configured: string = TOKEN,
  secret: string = SECRET,
): DemoAuthGuard {
  const cfg = {
    demoApiToken: configured,
    demoGateSecret: secret,
  } as unknown as McConfig;
  return new DemoAuthGuard(cfg);
}

/** Minimal ExecutionContext over the three request fields the guard reads. */
function ctx(
  path: string,
  headers: Record<string, string> = {},
  method = 'GET',
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path, headers, method }) }),
  } as unknown as ExecutionContext;
}

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
/** A live proof under SECRET — what a browser that passed the gate actually sends. */
const proof = (secret = SECRET) => signGateProof(secret, 3600).proof;
/** Both factors, which is what every route here now requires. */
const authed = (t = TOKEN, secret = SECRET) => ({
  ...bearer(t),
  'x-xbs-gate': proof(secret),
});

describe('DemoAuthGuard', () => {
  // FIRST, because docker-compose's healthcheck curls /health with no token: if this ever
  // starts throwing, containers are marked unhealthy and `depends_on` stalls the whole stack.
  it('lets /health through without a token', () => {
    expect(make().canActivate(ctx('/health'))).toBe(true);
    expect(PUBLIC_PATHS.has('/health')).toBe(true);
  });

  it('accepts a valid bearer token together with a valid gate proof', () => {
    expect(make().canActivate(ctx('/xbs/balances', authed()))).toBe(true);
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => make().canActivate(ctx('/xbs/balances'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong token', () => {
    expect(() =>
      make().canActivate(ctx('/xbs/balances', bearer('wrong'))),
    ).toThrow(UnauthorizedException);
  });

  // The fail-closed invariant, and it bites harder here than in app-bff: these routes sign
  // real Mastercard sandbox calls with the platform's OAuth1 key on live-default capabilities.
  it('denies every request when no token is configured — even a matching one', () => {
    expect(() => make('').canActivate(ctx('/xbs/balances'))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      make('').canActivate(ctx('/xbs/balances', bearer(''))),
    ).toThrow(UnauthorizedException);
  });

  it('/health stays public even with no token configured', () => {
    expect(make('').canActivate(ctx('/health'))).toBe(true);
  });

  it.each([
    ['no scheme', { authorization: TOKEN }],
    ['wrong scheme', { authorization: `Basic ${TOKEN}` }],
    ['empty value', { authorization: '' }],
    ['scheme only', { authorization: 'Bearer' }],
    ['extra segment', { authorization: `Bearer ${TOKEN} extra` }],
  ])('rejects a malformed Authorization header (%s)', (_label, headers) => {
    expect(() => make().canActivate(ctx('/xbs/balances', headers))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the scheme case-insensitively, as RFC 7235 requires', () => {
    expect(
      make().canActivate(
        ctx('/xbs/balances', {
          authorization: `bearer ${TOKEN}`,
          'x-xbs-gate': proof(),
        }),
      ),
    ).toBe(true);
  });

  // Preflight carries no Authorization header — it is the request asking whether that header
  // may be sent. Nest's cors middleware normally answers it first; this keeps a middleware
  // reorder from turning every cross-origin call into a confusing 401.
  it('lets CORS preflight through', () => {
    expect(make().canActivate(ctx('/xbs/balances', {}, 'OPTIONS'))).toBe(true);
  });

  it('treats a trailing slash on a public path as the same path', () => {
    expect(make().canActivate(ctx('/health/'))).toBe(true);
  });

  // Path matching must err toward 401, never toward "public". These all LOOK health-ish.
  it.each([
    '/healthz',
    '/health/secrets',
    '//health',
    '/HEALTH',
    '/features/health',
  ])('does not treat %s as the public /health route', (path) => {
    expect(() => make().canActivate(ctx(path))).toThrow(UnauthorizedException);
  });
});

/**
 * The gate proof: the SECOND factor. The bearer token is served to every anonymous visitor in the
 * frontend's /config.js, so on its own it is not a boundary — these are the cases that make it one.
 * This service only ever VERIFIES proofs; app-bff mints them.
 */
describe('DemoAuthGuard — gate proof', () => {
  it('rejects a valid bearer token with NO proof', () => {
    expect(() =>
      make().canActivate(ctx('/xbs/balances', bearer(TOKEN))),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired proof', () => {
    const expired = signGateProof(SECRET, -60).proof; // signed, but already past
    expect(() =>
      make().canActivate(
        ctx('/xbs/balances', { ...bearer(TOKEN), 'x-xbs-gate': expired }),
      ),
    ).toThrow(UnauthorizedException);
  });

  // The drift case, stated from this side: if this service's DEMO_GATE_SECRET does not match
  // app-bff's, the dashboard keeps working and every cross-border page 401s.
  it('rejects a proof signed with a different secret', () => {
    expect(() =>
      make().canActivate(
        ctx('/xbs/balances', authed(TOKEN, 'a-different-secret')),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a proof whose expiry was edited to extend the session', () => {
    const [v, e, s] = proof().split('.');
    const tampered = `${v}.${Number(e) + 86_400}.${s}`;
    expect(() =>
      make().canActivate(
        ctx('/xbs/balances', { ...bearer(TOKEN), 'x-xbs-gate': tampered }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it.each([
    ['garbage', 'not-a-proof'],
    ['empty', ''],
    ['only separators', '..'],
  ])('rejects a malformed proof (%s) without throwing a 500', (_l, value) => {
    expect(() =>
      make().canActivate(
        ctx('/xbs/balances', { ...bearer(TOKEN), 'x-xbs-gate': value }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('denies every route when no gate secret is configured', () => {
    expect(() =>
      make(TOKEN, '').canActivate(ctx('/xbs/balances', authed())),
    ).toThrow(UnauthorizedException);
  });

  // Load-bearing for the container healthcheck, which sends neither factor.
  it('/health passes with no proof AND no secret configured', () => {
    expect(make(TOKEN, '').canActivate(ctx('/health'))).toBe(true);
  });

  /**
   * THE regression test for this file. `/gate/verify` is exempt in app-bff because that service
   * mints proofs; this service mints nothing, so copying the exempt set over — an easy mistake
   * given the two guards are otherwise deliberate twins — would open a cross-border route.
   */
  it('exempts NOTHING — the exempt set is empty here, unlike app-bff', () => {
    expect(GATE_EXEMPT_PATHS.size).toBe(0);
  });

  it('does not exempt /gate/verify, which does not exist in this service', () => {
    expect(() =>
      make().canActivate(ctx('/gate/verify', bearer(TOKEN), 'POST')),
    ).toThrow(UnauthorizedException);
  });

  // Spot-check the hot paths: every area of this service demands both factors.
  it.each([
    '/xbs/balances',
    '/xbs/quote',
    '/xbs/pay',
    '/features/rates',
    '/features/rfi/documents',
  ])('requires both factors on %s', (path) => {
    expect(() => make().canActivate(ctx(path, bearer(TOKEN)))).toThrow(
      UnauthorizedException,
    );
    expect(make().canActivate(ctx(path, authed()))).toBe(true);
  });
});
