import axios from 'axios';
import oauthSigner = require('mastercard-oauth1-signer');
import { GatewayConfig } from '../../config/gateway-config';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { McCredentials } from '../../credentials/credentials.types';
import { MastercardClient } from './mastercard-client.service';

jest.mock('axios');
jest.mock('mastercard-oauth1-signer', () => ({
  getAuthorizationHeader: jest.fn(() => 'OAuth oauth_signature="x"'),
}));

const signMock = oauthSigner.getAuthorizationHeader as unknown as jest.Mock;

const creds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'PID',
} as McCredentials;

type Handler = (x: unknown) => unknown;

/** Minimal stand-in for the axios AxiosHeaders interface the interceptor uses. */
interface FakeHeaders {
  set(k: string, v: string): void;
  has(k: string): boolean;
  get(k: string): string | undefined;
}
interface FakeReqConfig {
  url: string;
  baseURL: string;
  method: string;
  data: unknown;
  mcCreds: McCredentials;
  headers: FakeHeaders;
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

function reqConfig(body: unknown, method = 'post'): FakeReqConfig {
  return {
    url: '/send/v1/p/quotes',
    baseURL: 'https://mc.test',
    method,
    data: body,
    mcCreds: creds,
    headers: fakeHeaders(),
  };
}

function setup(decrypt?: (d: unknown) => unknown) {
  let resHandler: Handler = (r) => r;
  let reqHandler: Handler = (c) => c;
  const httpRequest = jest.fn();
  const encryptRequest = jest.fn((_creds: unknown, body: unknown) => ({
    body,
    encrypted: false,
  }));
  const fakeHttp = {
    interceptors: {
      request: { use: jest.fn((h: Handler) => (reqHandler = h)) },
      response: { use: jest.fn((h: Handler) => (resHandler = h)) },
    },
    request: httpRequest,
  };
  (axios.create as jest.Mock).mockReturnValue(fakeHttp);

  const encryption = {
    encryptRequest,
    decryptResponse: jest.fn((_creds: unknown, d: unknown) =>
      decrypt ? decrypt(d) : d,
    ),
  } as unknown as EncryptionService;
  const config = { baseUrl: 'https://mc.test' } as GatewayConfig;

  const client = new MastercardClient(config, encryption);
  return {
    client,
    httpRequest,
    encryptRequest,
    getResHandler: () => resHandler,
    getReqHandler: () => reqHandler,
  };
}

describe('MastercardClient — request interceptor (encrypt + sign)', () => {
  afterEach(() => jest.clearAllMocks());

  it('encrypts the body, then OAuth1-signs over the final (serialized) payload', () => {
    const { getReqHandler, encryptRequest } = setup();
    const body = { quoterequest: { transaction_reference: 'TX1' } };
    const cfg = reqConfig(body);

    const out = getReqHandler()(cfg) as FakeReqConfig;

    // encryption ran with the tenant creds + the original body
    expect(encryptRequest).toHaveBeenCalledWith(creds, body);
    // the body is serialized into config.data
    expect(out.data).toBe(JSON.stringify(body));
    // the signature is computed over the FINAL payload (encrypt → then sign), with our creds
    expect(signMock).toHaveBeenCalledWith(
      'https://mc.test/send/v1/p/quotes',
      'POST',
      JSON.stringify(body),
      'ck',
      'pem',
    );
    expect(cfg.headers.get('Authorization')).toBe('OAuth oauth_signature="x"');
    expect(cfg.headers.get('Content-Type')).toBe('application/json');
  });

  it('sets x-encrypted when the body was actually encrypted', () => {
    const { getReqHandler, encryptRequest } = setup();
    encryptRequest.mockReturnValueOnce({ body: 'JWE.compact.token', encrypted: true });
    const cfg = reqConfig({ a: 1 });

    const out = getReqHandler()(cfg) as FakeReqConfig;

    expect(cfg.headers.get('x-encrypted')).toBe('true');
    // an already-string (JWE) payload is sent as-is, not re-serialized
    expect(out.data).toBe('JWE.compact.token');
    expect(cfg.headers.get('Authorization')).toBeDefined();
  });

  it('a deterministic request-encryption failure is NOT retried on GET', async () => {
    const { client, httpRequest, encryptRequest, getReqHandler } = setup();
    encryptRequest.mockImplementation(() => {
      throw new Error('per-tenant fail-loud');
    });
    // Simulate axios running the request interceptor before the HTTP call.
    httpRequest.mockImplementation(async (c: unknown) => getReqHandler()(c));

    await expect(
      client.request(creds, { method: 'GET', path: '/p', body: { a: 1 } }),
    ).rejects.toThrow('per-tenant fail-loud');
    // GET would normally retry, but a deterministic crypto error must not.
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });
});

describe('MastercardClient — retry matrix', () => {
  afterEach(() => jest.clearAllMocks());

  it('GET retries a transient 502 up to 3 times, then 200', async () => {
    const { client, httpRequest } = setup();
    httpRequest
      .mockResolvedValueOnce({ status: 502, data: 'x' })
      .mockResolvedValueOnce({ status: 503, data: 'x' })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const res = await client.request(creds, { method: 'GET', path: '/p' });
    expect(res).toEqual({ status: 200, data: { ok: true } });
    expect(httpRequest).toHaveBeenCalledTimes(3);
  });

  it('GET: all attempts transient → returns the last status after 3 calls', async () => {
    const { client, httpRequest } = setup();
    httpRequest.mockResolvedValue({ status: 503, data: 'x' });
    const res = await client.request(creds, { method: 'GET', path: '/p' });
    expect(res.status).toBe(503);
    expect(httpRequest).toHaveBeenCalledTimes(3);
  });

  it('POST is NEVER retried (protection against double charging)', async () => {
    const { client, httpRequest } = setup();
    httpRequest.mockResolvedValue({ status: 503, data: 'x' });
    const res = await client.request(creds, {
      method: 'POST',
      path: '/p',
      body: {},
    });
    expect(res.status).toBe(503);
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });

  it('GET retries back off linearly (200ms, then 400ms) — not a hot loop', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const { client, httpRequest } = setup();
    httpRequest.mockResolvedValue({ status: 503, data: 'x' });
    await client.request(creds, { method: 'GET', path: '/p' });
    // axios is mocked, so the only setTimeout calls are the retry backoffs.
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toEqual(expect.arrayContaining([200, 400]));
    setTimeoutSpy.mockRestore();
  });

  it('network error on GET is retried; on POST — not', async () => {
    const get = setup();
    get.httpRequest.mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      get.client.request(creds, { method: 'GET', path: '/p' }),
    ).rejects.toThrow();
    expect(get.httpRequest).toHaveBeenCalledTimes(3);

    const post = setup();
    post.httpRequest.mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      post.client.request(creds, { method: 'POST', path: '/p', body: {} }),
    ).rejects.toThrow();
    expect(post.httpRequest).toHaveBeenCalledTimes(1);
  });
});

describe('MastercardClient — decrypt-no-retry (regression)', () => {
  afterEach(() => jest.clearAllMocks());

  it('a deterministic decryption error is NOT retried even on GET', async () => {
    const { client, httpRequest, getResHandler } = setup(() => {
      throw new Error('bad key');
    });
    // fakeHttp.request runs the RESPONSE interceptor → decrypt throws →
    // ResponseDecryptError surfaces as a rejection of request() itself.
    httpRequest.mockImplementation(async () =>
      getResHandler()({ status: 200, data: 'enc', headers: {}, config: {} }),
    );
    await expect(
      client.request(creds, { method: 'GET', path: '/p' }),
    ).rejects.toThrow();
    // GET, but NO retry: the crypto error is deterministic.
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });
});
