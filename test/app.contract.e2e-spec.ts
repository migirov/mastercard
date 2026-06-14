/**
 * ГЕРМЕТИЧНЫЙ e2e (CI-дефолт). Поднимает всё приложение, но MastercardClient и
 * CredentialsService подменены стабами — НЕ ходит в живой MC и НЕ требует
 * реальных certs/p12. Это позволяет детерминированно проверить ветки маппинга
 * ответа, которые live-сьют (app.e2e-spec.ts) структурно достать НЕ может:
 * MC 401/5xx → 502 (тело скрыто), MC 4xx-объект → единый конверт с `upstream`,
 * MC 4xx-не-объект (HTML) → 502, успех → форма ответа. Плюс input-валидация.
 *
 * Нужен только Postgres (сиды/kv/audit) + dev-.env (dummy-секреты). Запуск:
 *   node node_modules\jest\bin\jest.js --config ./test/jest-e2e.json
 * Живой sandbox-сьют — отдельно: --config ./test/jest-e2e-live.json.
 */
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import axios, { AxiosInstance } from 'axios';
import { AppModule } from '../src/app.module';
import { CredentialsService } from '../src/credentials/credentials.service';
import { MastercardClient } from '../src/mastercard/mastercard-client.service';
import {
  RFI_UPLOAD_PATH,
  rfiUploadBodyParser,
} from '../src/common/rfi-upload.bodyparser';

const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;

// Управляемый стаб MC: тест задаёт следующий ответ (или throw) перед вызовом.
const stubMc: {
  next: { status: number; data: unknown };
  shouldThrow: boolean;
  request: jest.Mock;
} = {
  next: { status: 200, data: { ok: true } },
  shouldThrow: false,
  request: jest.fn(),
};
stubMc.request.mockImplementation(async () => {
  if (stubMc.shouldThrow) throw new Error('network down');
  return stubMc.next;
});

const stubCreds = {
  resolve: async () => ({
    consumerKey: 'ck',
    signingKeyPem: 'pem',
    partnerId: 'SANDBOX_1234567',
  }),
};

describe('Mastercard gateway (e2e, hermetic/stubbed MC)', () => {
  let app: NestExpressApplication;
  let http: AxiosInstance;
  let internal: Record<string, string>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MastercardClient)
      .useValue(stubMc)
      .overrideProvider(CredentialsService)
      .useValue(stubCreds)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: false,
      rawBody: true,
    });
    app.use(RFI_UPLOAD_PATH, rfiUploadBodyParser());
    app.useBodyParser('json', { limit: '256kb' });
    app.useBodyParser('urlencoded', { extended: false, limit: '256kb' });
    await app.listen(PORT);

    http = axios.create({ baseURL: BASE, validateStatus: () => true });
    // acme — сид PLATFORM/ACTIVE; creds резолвятся стабом (без certs).
    internal = {
      'x-internal-token': process.env.MC_INTERNAL_TOKEN ?? '',
      'x-tenant-id': 'acme',
    };
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    stubMc.shouldThrow = false;
    stubMc.next = { status: 200, data: { ok: true } };
  });

  // --- response-mapping ветки (live-сьют их достать не может) ---

  it('MC 2xx → данные мерчанту как есть', async () => {
    stubMc.next = { status: 200, data: { accounts: [{ id: 'a' }] } };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ accounts: [{ id: 'a' }] });
  });

  it('MC бизнес-4xx (объект) → 422 с единым конвертом и upstream-телом', async () => {
    const mcBody = { Errors: { Error: { ReasonCode: 'DECLINE' } } };
    stubMc.next = { status: 422, data: mcBody };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(422);
    expect(r.data.error).toBe('Upstream Error');
    expect(r.data.upstream).toEqual(mcBody);
  });

  it('MC 401 → 502, тело/детали НЕ утекают', async () => {
    stubMc.next = { status: 401, data: { secret: 'internal-cred-detail' } };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.data)).not.toContain('internal-cred-detail');
  });

  it('MC 4xx с НЕ-объектным телом (HTML) → 502 (не форвардим)', async () => {
    stubMc.next = { status: 429, data: '<html>rate limited</html>' };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.data)).not.toContain('<html>');
  });

  it('MC 5xx → 502', async () => {
    stubMc.next = { status: 503, data: { boom: 1 } };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
  });

  it('сетевой сбой к MC → 502', async () => {
    stubMc.shouldThrow = true;
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
  });

  // --- input-валидация (до MC; детерминированно без сети) ---

  it('POST /crossborder/quotes amount=number → 400 (mcPassthroughPipe DTO)', async () => {
    const r = await http.post(
      '/crossborder/quotes',
      { quoterequest: { payment_amount: { amount: 105.15, currency: 'USD' } } },
      { headers: internal },
    );
    expect(r.status).toBe(400);
  });

  it('POST /oauth/token grant_type=password → 400 (RFC 6749 {error})', async () => {
    const r = await http.post('/oauth/token', {
      grant_type: 'password',
      client_id: 'x',
      client_secret: 'y',
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBeDefined();
  });

  it('POST /webhooks/mastercard без токена → 401 (fail-closed)', async () => {
    const r = await http.post('/webhooks/mastercard', { eventType: 'noop' });
    expect(r.status).toBe(401);
  });

  it('GET /crossborder/payments?ref=a/b → 400 (SafeIdPipe анти-инъекция)', async () => {
    const r = await http.get('/crossborder/payments?ref=a%2Fb', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });
});
