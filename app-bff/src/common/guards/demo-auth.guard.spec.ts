import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { DemoAuthGuard, PUBLIC_PATHS } from './demo-auth.guard';

const TOKEN = 's3cret-token-value';

function make(configured: string = TOKEN): DemoAuthGuard {
  const cfg = { demoApiToken: configured } as unknown as AppConfig;
  return new DemoAuthGuard(cfg);
}

/** Minimal ExecutionContext over the two request fields the guard reads. */
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

describe('DemoAuthGuard', () => {
  // FIRST, because docker-compose's healthcheck curls /health with no token: if this ever
  // starts throwing, containers are marked unhealthy and `depends_on` stalls the whole stack.
  it('lets /health through without a token', () => {
    expect(make().canActivate(ctx('/health'))).toBe(true);
    expect(PUBLIC_PATHS.has('/health')).toBe(true);
  });

  it('accepts a valid bearer token', () => {
    expect(make().canActivate(ctx('/entities/Invoice', bearer(TOKEN)))).toBe(
      true,
    );
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
      make().canActivate(ctx('/e', { authorization: `bearer ${TOKEN}` })),
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
