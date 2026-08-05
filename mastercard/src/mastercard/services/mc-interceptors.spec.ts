import { Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { McAuthStrategy } from '../auth/mc-auth.types';
import { AuthHeaderError, RequestEncryptError } from './mc.errors';
import { installMcInterceptors } from './mc-interceptors';

/**
 * Direct tests for the request interceptor. Reaching it only through
 * `MastercardClient` (whose strategy never fails) left the entire failure path
 * untested: the auth budget, the sync-throw guard and the error wrapping could all
 * be deleted without a single test going red.
 */

const creds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'PID',
} as McCredentials;

interface FakeHeaders {
  set(k: string, v: string): void;
  has(k: string): boolean;
  get(k: string): string | undefined;
}

function fakeHeaders(): FakeHeaders {
  const store: Record<string, string> = {};
  return {
    set: (k, v) => {
      store[k] = v;
    },
    has: (k) => k in store,
    get: (k) => store[k],
  };
}

type ReqHandler = (c: unknown) => Promise<unknown>;

/** Install the interceptors on a fake axios and hand back the request handler. */
function install(strategy: Partial<McAuthStrategy>) {
  let reqHandler: ReqHandler = async (c) => c;
  const http = {
    interceptors: {
      request: { use: (h: ReqHandler) => (reqHandler = h) },
      response: { use: jest.fn() },
    },
  } as unknown as AxiosInstance;

  const encryption = {
    encryptRequest: (_c: unknown, body: unknown) => ({
      body,
      encrypted: false,
    }),
    decryptResponse: (_c: unknown, d: unknown) => d,
  } as unknown as EncryptionService;

  installMcInterceptors(
    http,
    encryption,
    { mode: 'oauth1', ...strategy } as McAuthStrategy,
    new Logger('test'),
  );

  const config = {
    url: '/send/v1/p/quotes',
    baseURL: 'https://mc.test',
    method: 'post',
    data: { a: 1 },
    mcCreds: creds,
    headers: fakeHeaders(),
  };
  return { run: () => reqHandler(config), config };
}

describe('mc-interceptors — request authentication', () => {
  it('applies EVERY header the strategy returns, not just Authorization', async () => {
    // The contract is a map precisely so a scheme can set more than one header.
    const { run, config } = install({
      authHeaders: async () => ({
        Authorization: 'token',
        'X-Extra': 'second',
      }),
    });

    await run();

    expect(config.headers.get('Authorization')).toBe('token');
    expect(config.headers.get('X-Extra')).toBe('second');
  });

  it('wraps a rejecting strategy in AuthHeaderError, marked not-sent', async () => {
    const inner = new Error('p12 gone');
    const { run } = install({
      authHeaders: async () => {
        throw inner;
      },
    });

    const err = await run().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AuthHeaderError);
    expect((err as AuthHeaderError).sent).toBe(false);
    expect((err as AuthHeaderError).cause).toBe(inner);
    // the mode and the original message both survive for diagnosis
    expect((err as Error).message).toContain('oauth1');
    expect((err as Error).message).toContain('p12 gone');
  });

  it('wraps a strategy that throws SYNCHRONOUSLY', async () => {
    // Not declared `async`: without the thunk in withBudget the throw escapes the
    // wrapper entirely, and the raw Error would let the retry loop re-send a GET.
    const { run } = install({
      authHeaders: (() => {
        throw new Error('sync boom');
      }) as unknown as McAuthStrategy['authHeaders'],
    });

    await expect(run()).rejects.toBeInstanceOf(AuthHeaderError);
  });

  it('cuts off a hanging strategy at the budget instead of stalling inside the payment lock', async () => {
    jest.useFakeTimers();
    const { run } = install({
      authHeaders: () => new Promise(() => undefined),
    });

    const pending = run().catch((e: unknown) => e);
    jest.advanceTimersByTime(5_000);
    const err = await pending;

    expect(err).toBeInstanceOf(AuthHeaderError);
    expect((err as Error).message).toMatch(/did not produce headers within/);
    jest.useRealTimers();
  });

  it('a missing-credentials config is a pre-send error, not a bare Error', async () => {
    // A plain Error here would be retried on GET and would hold the idempotency slot.
    const { run } = install({ authHeaders: async () => ({}) });
    const badConfig = {
      url: '/x',
      baseURL: 'https://mc.test',
      method: 'get',
      headers: fakeHeaders(),
    };
    let handler: ReqHandler = async (c) => c;
    const http = {
      interceptors: {
        request: { use: (h: ReqHandler) => (handler = h) },
        response: { use: jest.fn() },
      },
    } as unknown as AxiosInstance;
    installMcInterceptors(
      http,
      {
        encryptRequest: () => ({ body: undefined, encrypted: false }),
      } as never,
      { mode: 'oauth1', authHeaders: async () => ({}) } as McAuthStrategy,
      new Logger('test'),
    );

    const err = await handler(badConfig).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RequestEncryptError);
    expect((err as RequestEncryptError).sent).toBe(false);
    void run;
  });
});
