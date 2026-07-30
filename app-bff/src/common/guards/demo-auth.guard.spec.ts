import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
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
  } as unknown as AppConfig;
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
/** Both factors, which is what every non-exempt route now requires. */
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
    expect(make().canActivate(ctx('/entities/Invoice', authed()))).toBe(true);
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => make().canActivate(ctx('/entities/Invoice'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong token', () => {
    expect(() =>
      make().canActivate(ctx('/entities/Invoice', bearer('wrong'))),
    ).toThrow(UnauthorizedException);
  });

  // The fail-closed invariant: an unconfigured secret must DENY, never wave everything past.
  // Getting this backwards would silently restore the open API this guard exists to close.
  it('denies every request when no token is configured — even a matching one', () => {
    expect(() => make('').canActivate(ctx('/entities/Invoice'))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      make('').canActivate(ctx('/entities/Invoice', bearer(''))),
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
    expect(() => make().canActivate(ctx('/entities/Invoice', headers))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the scheme case-insensitively, as RFC 7235 requires', () => {
    expect(
      make().canActivate(
        ctx('/e', { authorization: `bearer ${TOKEN}`, 'x-xbs-gate': proof() }),
      ),
    ).toBe(true);
  });

  // Preflight carries no Authorization header — it is the request asking whether that header
  // may be sent. Nest's cors middleware normally answers it first; this keeps a middleware
  // reorder from turning every cross-origin call into a confusing 401.
  it('lets CORS preflight through', () => {
    expect(make().canActivate(ctx('/entities/Invoice', {}, 'OPTIONS'))).toBe(
      true,
    );
  });

  it('treats a trailing slash on a public path as the same path', () => {
    expect(make().canActivate(ctx('/health/'))).toBe(true);
  });

  // Path matching must err toward 401, never toward "public". These all LOOK health-ish.
  it.each(['/healthz', '/health/secrets', '//health', '/HEALTH', '/x/health'])(
    'does not treat %s as the public /health route',
    (path) => {
      expect(() => make().canActivate(ctx(path))).toThrow(
        UnauthorizedException,
      );
    },
  );
});

/**
 * The gate proof: the SECOND factor. The bearer token is served to every anonymous visitor in
 * /config.js, so on its own it is not a boundary — these are the cases that make it one.
 */
describe('DemoAuthGuard — gate proof', () => {
  it('rejects a valid bearer token with NO proof', () => {
    expect(() =>
      make().canActivate(ctx('/entities/Invoice', bearer(TOKEN))),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired proof', () => {
    const expired = signGateProof(SECRET, -60).proof; // signed, but already past
    expect(() =>
      make().canActivate(
        ctx('/entities/Invoice', { ...bearer(TOKEN), 'x-xbs-gate': expired }),
      ),
    ).toThrow(UnauthorizedException);
  });

  // The cross-service drift case: mastercard-bff holding a different DEMO_GATE_SECRET must not
  // accept app-bff's proofs, and vice versa.
  it('rejects a proof signed with a different secret', () => {
    expect(() =>
      make().canActivate(
        ctx('/entities/Invoice', authed(TOKEN, 'a-different-secret')),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a proof whose expiry was edited to extend the session', () => {
    const [v, e, s] = proof().split('.');
    const tampered = `${v}.${Number(e) + 86_400}.${s}`;
    expect(() =>
      make().canActivate(
        ctx('/entities/Invoice', { ...bearer(TOKEN), 'x-xbs-gate': tampered }),
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
        ctx('/entities/Invoice', { ...bearer(TOKEN), 'x-xbs-gate': value }),
      ),
    ).toThrow(UnauthorizedException);
  });

  // Fail-closed on the SECRET, mirroring the token invariant above: an unconfigured
  // DEMO_GATE_SECRET must deny everything rather than accept forged proofs.
  it('denies every non-exempt route when no gate secret is configured', () => {
    expect(() =>
      make(TOKEN, '').canActivate(ctx('/entities/Invoice', authed())),
    ).toThrow(UnauthorizedException);
  });

  // Load-bearing for the container healthcheck, which sends neither factor.
  it('/health passes with no proof AND no secret configured', () => {
    expect(make(TOKEN, '').canActivate(ctx('/health'))).toBe(true);
  });

  // /gate/verify is what MINTS a proof — requiring one would make the gate unopenable.
  it('exempts /gate/verify from the proof, but not from the token', () => {
    expect(make().canActivate(ctx('/gate/verify', bearer(TOKEN), 'POST'))).toBe(
      true,
    );
    expect(() => make().canActivate(ctx('/gate/verify', {}, 'POST'))).toThrow(
      UnauthorizedException,
    );
  });

  it('exempts /gate/verify with a trailing slash too', () => {
    expect(
      make().canActivate(ctx('/gate/verify/', bearer(TOKEN), 'POST')),
    ).toBe(true);
  });

  // The exempt set must stay exactly this. Adding an entry punches a hole straight through the
  // second factor, so the size is asserted, not just the membership.
  it('exempts nothing beyond /gate/verify', () => {
    expect([...GATE_EXEMPT_PATHS]).toEqual(['/gate/verify']);
  });

  it.each(['/gate/verifyx', '/gate', '/x/gate/verify', '/GATE/VERIFY'])(
    'does not treat %s as the exempt /gate/verify route',
    (path) => {
      expect(() =>
        make().canActivate(ctx(path, bearer(TOKEN), 'POST')),
      ).toThrow(UnauthorizedException);
    },
  );
});
