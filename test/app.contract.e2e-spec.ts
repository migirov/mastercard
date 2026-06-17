/**
 * ГЕРМЕТИЧНЫЙ e2e (CI-дефолт). Поднимает всё приложение, но MastercardClient и
 * CredentialsService подменены стабами — НЕ ходит в живой MC и НЕ требует
 * реальных certs/p12. Это позволяет детерминированно проверить ветки маппинга
 * ответа, которые live-сьют (app.e2e-spec.ts) структурно достать НЕ может:
 * MC 401/5xx → 502 (тело скрыто), MC 4xx-объект → единый конверт с `upstream`,
 * MC 4xx-не-объект (HTML) → 502, успех → форма ответа. Плюс input-валидация.
 *
 * Нужен только Postgres (сиды/идемпотентность/дедуп/audit) + dev-.env (dummy-секреты). Запуск:
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

  // --- новые эндпоинты (доработка покрытия) ---

  it('GET /crossborder/rates (Carded/FX Rate Pull) → MC 2xx форвардится', async () => {
    stubMc.next = { status: 200, data: { rates: [{ rate_id: 'r1' }] } };
    const r = await http.get('/crossborder/rates', { headers: internal });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ rates: [{ rate_id: 'r1' }] });
    // путь и метод, ушедшие в MC (Pull = GET, без тела)
    const sent = stubMc.request.mock.calls.at(-1)?.[1];
    expect(sent).toMatchObject({ method: 'GET' });
    expect(sent.path).toContain('/crossborder/rates');
  });

  it('POST /crossborder/quotes/cancellations → MC 2xx форвардится', async () => {
    stubMc.next = { status: 200, data: { status: 'CANCELLED' } };
    const r = await http.post(
      '/crossborder/quotes/cancellations',
      { transactionReference: 'TX1', proposalId: 'pen_1' },
      { headers: internal },
    );
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ status: 'CANCELLED' });
    expect(stubMc.request.mock.calls.at(-1)?.[1].path).toContain(
      '/crossborder/quotes/cancellations',
    );
  });

  it('GET /crossborder/quotes/:ref/proposals/:id (Retrieve Confirmed Quote) → MC 2xx форвардится', async () => {
    stubMc.next = {
      status: 200,
      data: { confirmStatus: { status: 'CONFIRMED' } },
    };
    const r = await http.get('/crossborder/quotes/TX1/proposals/pen_1', {
      headers: internal,
    });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ confirmStatus: { status: 'CONFIRMED' } });
    expect(stubMc.request.mock.calls.at(-1)?.[1].path).toContain(
      '/crossborder/quotes/TX1/proposals/pen_1',
    );
  });

  it('POST /crossborder/payments — идемпотентность по transaction_reference (Postgres, без KV)', async () => {
    const ref = `E2EIDEM_${Date.now()}`;
    const body = { paymentrequest: { transaction_reference: ref } };

    // 1) первый платёж → доходит до MC, результат кэшируется в payment_idempotency
    stubMc.next = { status: 200, data: { paymentId: 'PAY1' } };
    const before = stubMc.request.mock.calls.length;
    const p1 = await http.post('/crossborder/payments', body, {
      headers: internal,
    });
    expect(p1.status).toBe(201);
    expect(p1.data).toEqual({ paymentId: 'PAY1' });
    expect(stubMc.request.mock.calls.length).toBe(before + 1);

    // 2) ретрай тем же ref+телом → отдаём КЭШ из Postgres, MC повторно НЕ зовём
    stubMc.next = { status: 200, data: { paymentId: 'MUST_NOT_LEAK' } };
    const p2 = await http.post('/crossborder/payments', body, {
      headers: internal,
    });
    expect(p2.status).toBe(201);
    expect(p2.data).toEqual({ paymentId: 'PAY1' }); // кэш, не новый ответ MC
    expect(stubMc.request.mock.calls.length).toBe(before + 1); // MC не вызван второй раз

    // 3) тот же ref, ДРУГОЕ тело → 422 (защита от подмены платежа), MC не зовём
    const p3 = await http.post(
      '/crossborder/payments',
      {
        paymentrequest: {
          transaction_reference: ref,
          payment_amount: { amount: '5', currency: 'USD' },
        },
      },
      { headers: internal },
    );
    expect(p3.status).toBe(422);
    expect(stubMc.request.mock.calls.length).toBe(before + 1);
  });

  it('Status Change Push: вебхук → персист в tx_status → polling → дедуп (без MC)', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    // Уникальные ref/eventRef на прогон — tx_status персистентна между запусками.
    const ref = `E2ETX_${Date.now()}`;
    const eventRef = `whe2e_${Date.now()}`;
    const body = {
      eventRef,
      eventType: 'STATUS_CHG',
      transactionReference: ref,
      partnerId: 'NOT_AN_OWN_PARTNER', // нет OWN-тенанта → общий пул (tenantId=null)
      transactionType: 'PAYMENT',
      quote: { confirmStatus: { status: 'CONFIRMED' } },
    };

    // 1) приём + атомарный персист
    const post1 = await http.post('/webhooks/mastercard', body, {
      headers: webhook,
    });
    expect(post1.status).toBe(200);
    expect(post1.data).toEqual({ status: 'accepted' });

    // 2) polling мерчантом (acme = PLATFORM → видит общий пул по ref)
    const poll = await http.get(`/crossborder/status-events?ref=${ref}`, {
      headers: internal,
    });
    expect(poll.status).toBe(200);
    expect(Array.isArray(poll.data)).toBe(true);
    expect(poll.data).toHaveLength(1);
    expect(poll.data[0]).toMatchObject({
      transactionReference: ref,
      eventType: 'STATUS_CHG',
      transactionType: 'PAYMENT',
      status: 'CONFIRMED',
    });
    // view-DTO whitelist: внутренние поля наружу НЕ отдаются
    expect(poll.data[0].id).toBeUndefined();
    expect(poll.data[0].tenantId).toBeUndefined();
    expect(poll.data[0].payload).toBeDefined();

    // 3) ретрай MC того же eventRef → дубликат (дедуп = UNIQUE(eventRef))
    const post2 = await http.post('/webhooks/mastercard', body, {
      headers: webhook,
    });
    expect(post2.data).toEqual({ status: 'duplicate' });
  });

  it('атрибуция/изоляция: OWN видит своё, PLATFORM — общий пул; перекрёстно — нет', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    // own-demo — сид OWN с partnerId='OWN_PARTNER_TBD' (см. TenantRegistry).
    const ownInternal = {
      'x-internal-token': process.env.MC_INTERNAL_TOKEN ?? '',
      'x-tenant-id': 'own-demo',
    };
    const t = Date.now();
    const refOwn = `E2EOWN_${t}`;
    const refPool = `E2EPOOL_${t}`;

    // A: partnerId совпадает с OWN-тенантом → атрибуция own-demo
    const a = await http.post(
      '/webhooks/mastercard',
      {
        eventRef: `whown_${t}`,
        eventType: 'STATUS_CHG',
        transactionReference: refOwn,
        partnerId: 'OWN_PARTNER_TBD',
        transactionType: 'PAYMENT',
      },
      { headers: webhook },
    );
    expect(a.data).toEqual({ status: 'accepted' });
    // B: неизвестный partnerId → общий пул (tenantId=null)
    const b = await http.post(
      '/webhooks/mastercard',
      {
        eventRef: `whpool_${t}`,
        eventType: 'STATUS_CHG',
        transactionReference: refPool,
        partnerId: 'NOBODY',
        transactionType: 'PAYMENT',
      },
      { headers: webhook },
    );
    expect(b.data).toEqual({ status: 'accepted' });

    // OWN видит своё событие; PLATFORM (acme) его НЕ видит (оно не в пуле)
    const ownSeesOwn = await http.get(
      `/crossborder/status-events?ref=${refOwn}`,
      { headers: ownInternal },
    );
    expect(ownSeesOwn.data).toHaveLength(1);
    const platSeesOwn = await http.get(
      `/crossborder/status-events?ref=${refOwn}`,
      { headers: internal },
    );
    expect(platSeesOwn.data).toHaveLength(0);

    // OWN НЕ видит общий пул; PLATFORM видит пул по ref
    const ownSeesPool = await http.get(
      `/crossborder/status-events?ref=${refPool}`,
      { headers: ownInternal },
    );
    expect(ownSeesPool.data).toHaveLength(0);
    const platSeesPool = await http.get(
      `/crossborder/status-events?ref=${refPool}`,
      { headers: internal },
    );
    expect(platSeesPool.data).toHaveLength(1);
  });

  it('overlong status усекается под колонку (varchar 32) — 200, не 500', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    const t = Date.now();
    const ref = `E2ETRUNC_${t}`;
    const post = await http.post(
      '/webhooks/mastercard',
      {
        eventRef: `whtrunc_${t}`,
        eventType: 'STATUS_CHG',
        transactionReference: ref,
        partnerId: 'NOBODY',
        transactionType: 'PAYMENT',
        quote: { confirmStatus: { status: 'S'.repeat(50) } },
      },
      { headers: webhook },
    );
    expect(post.status).toBe(200);
    expect(post.data).toEqual({ status: 'accepted' });

    const poll = await http.get(`/crossborder/status-events?ref=${ref}`, {
      headers: internal,
    });
    expect(poll.data).toHaveLength(1);
    expect(poll.data[0].status).toHaveLength(32); // усечено под varchar(32)
  });
});
