import axios from 'axios';
import { GatewayConfig } from '../../config/gateway-config';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { McCredentials } from '../../credentials/credentials.types';
import { MastercardClient } from './mastercard-client.service';

jest.mock('axios');
jest.mock('mastercard-oauth1-signer', () => ({
  getAuthorizationHeader: jest.fn(() => 'OAuth oauth_signature="x"'),
}));

const creds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'PID',
} as McCredentials;

type ResHandler = (r: unknown) => unknown;

function setup(decrypt?: (d: unknown) => unknown) {
  let resHandler: ResHandler = (r) => r;
  const httpRequest = jest.fn();
  const fakeHttp = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn((h: ResHandler) => (resHandler = h)) },
    },
    request: httpRequest,
  };
  (axios.create as jest.Mock).mockReturnValue(fakeHttp);

  const encryption = {
    encryptRequest: (_creds: unknown, body: unknown) => ({
      body,
      encrypted: false,
    }),
    decryptResponse: jest.fn((_creds: unknown, d: unknown) =>
      decrypt ? decrypt(d) : d,
    ),
  } as unknown as EncryptionService;
  const config = { baseUrl: 'https://mc.test' } as GatewayConfig;

  const client = new MastercardClient(config, encryption);
  return { client, httpRequest, getResHandler: () => resHandler };
}

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
