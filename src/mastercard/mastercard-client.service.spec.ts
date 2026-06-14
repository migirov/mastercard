import axios from 'axios';
import { GatewayConfig } from '../config/gateway-config';
import { EncryptionService } from '../encryption/encryption.service';
import { McCredentials } from '../credentials/credentials.types';
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

  it('GET ретраит транзиентный 502 до 3 раз, затем 200', async () => {
    const { client, httpRequest } = setup();
    httpRequest
      .mockResolvedValueOnce({ status: 502, data: 'x' })
      .mockResolvedValueOnce({ status: 503, data: 'x' })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const res = await client.request(creds, { method: 'GET', path: '/p' });
    expect(res).toEqual({ status: 200, data: { ok: true } });
    expect(httpRequest).toHaveBeenCalledTimes(3);
  });

  it('GET: все попытки транзиентны → возвращает последний статус после 3 вызовов', async () => {
    const { client, httpRequest } = setup();
    httpRequest.mockResolvedValue({ status: 503, data: 'x' });
    const res = await client.request(creds, { method: 'GET', path: '/p' });
    expect(res.status).toBe(503);
    expect(httpRequest).toHaveBeenCalledTimes(3);
  });

  it('POST НИКОГДА не ретраится (защита от двойного списания)', async () => {
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

  it('сетевая ошибка на GET ретраится; на POST — нет', async () => {
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

describe('MastercardClient — decrypt-no-retry (регресс)', () => {
  afterEach(() => jest.clearAllMocks());

  it('детерминированная ошибка расшифровки НЕ ретраится даже на GET', async () => {
    const { client, httpRequest, getResHandler } = setup(() => {
      throw new Error('bad key');
    });
    // fakeHttp.request прогоняет ОТВЕТНЫЙ интерцептор → decrypt бросает →
    // ResponseDecryptError всплывает как rejection самого request().
    httpRequest.mockImplementation(async () =>
      getResHandler()({ status: 200, data: 'enc', headers: {}, config: {} }),
    );
    await expect(
      client.request(creds, { method: 'GET', path: '/p' }),
    ).rejects.toThrow();
    // GET, но повтора НЕТ: ошибка крипты детерминирована.
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });
});
