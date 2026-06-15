/**
 * E2E против ЖИВОГО sandbox Mastercard. Поднимает реальное приложение на порту
 * 3999 (как dev-харнесс: bodyParser вручную, rawBody, без глобального pipe),
 * прогоняет HTTP-проверки через axios и закрывается. Требует: поднятый Postgres
 * (docker compose up -d) и валидный .env с креды sandbox.
 *
 *   npm run test:e2e
 *
 * Это НЕ юнит-тесты (jest по умолчанию их не подхватывает — отдельный конфиг
 * test/jest-e2e.json, testRegex .e2e-spec.ts$). Сетевые вызовы MC → длинный
 * testTimeout.
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import axios, { AxiosInstance } from 'axios';
import { AppModule } from '../src/app.module';
import {
  RFI_UPLOAD_PATH,
  rfiUploadBodyParser,
} from '../src/common/rfi-upload.bodyparser';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

describe('Mastercard gateway (e2e, live sandbox)', () => {
  let app: NestExpressApplication;
  let http: AxiosInstance;
  let internal: Record<string, string>;
  let admin: Record<string, string>;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
      bufferLogs: false,
      rawBody: true,
    });
    // как в main.ts: увеличенный лимит тела ТОЛЬКО для RFI-загрузки документа
    app.use(RFI_UPLOAD_PATH, rfiUploadBodyParser());
    app.useBodyParser('json', { limit: '256kb' });
    app.useBodyParser('urlencoded', { extended: false, limit: '256kb' });
    // как в main.ts: глобального pipe НЕТ — каждый контроллер несёт свой.
    await app.listen(PORT);

    http = axios.create({ baseURL: BASE, validateStatus: () => true });
    internal = {
      'x-internal-token': process.env.MC_INTERNAL_TOKEN ?? '',
      'x-tenant-id': 'own-sandbox',
    };
    admin = { 'x-admin-token': process.env.MC_ADMIN_TOKEN ?? '' };
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const quoteBody = () => ({
    quoterequest: {
      transaction_reference: `08E2E${Date.now()}`,
      sender_account_uri: 'tel:+25406005',
      recipient_account_uri: 'tel:+254069832',
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type: { forward: { receiver_currency: 'GBP' } },
    },
  });

  it('GET /crossborder/balances (sandbox) → 200', async () => {
    const bal = await http.get('/crossborder/balances', { headers: internal });
    expect(bal.status).toBe(200);
  });

  it('POST /crossborder/quotes (passthrough) → 200 с proposal/charged_amount', async () => {
    const q = await http.post('/crossborder/quotes', quoteBody(), {
      headers: internal,
    });
    expect([200, 201]).toContain(q.status);
    const s = JSON.stringify(q.data);
    expect(s.includes('proposal') || s.includes('charged_amount')).toBe(true);
  });

  it('POST /crossborder/quotes с amount=number → 400 (DTO @IsString)', async () => {
    const bad = quoteBody();
    // @ts-expect-error намеренно ломаем тип суммы: число вместо строки
    bad.quoterequest.payment_amount.amount = 105.15;
    const qb = await http.post('/crossborder/quotes', bad, {
      headers: internal,
    });
    expect(qb.status).toBe(400);
  });

  it('POST /admin/tenants OWN без secretRef → 400 (@ValidateIf)', async () => {
    const tn = await http.post(
      '/admin/tenants',
      { name: 'e2e-own', credentialMode: 'OWN' },
      { headers: admin },
    );
    expect(tn.status).toBe(400);
  });

  it('POST /oauth/token grant_type=password → 400 (@IsIn)', async () => {
    const tok = await http.post('/oauth/token', { grant_type: 'password' });
    expect(tok.status).toBe(400);
  });

  it('POST /webhooks/mastercard без токена → 401 (fail-closed)', async () => {
    const wh = await http.post('/webhooks/mastercard', { eventRef: 'x' });
    expect(wh.status).toBe(401);
  });

  it('POST /webhooks/mastercard с токеном → 200', async () => {
    const wh = await http.post(
      '/webhooks/mastercard',
      { eventRef: `e2e-${Date.now()}`, eventType: 'STATUS_CHG' },
      { headers: { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' } },
    );
    expect(wh.status).toBe(200);
  });

  it('GET /crossborder/payments?ref= (пусто) → 400 (SafeIdPipe)', async () => {
    const r = await http.get('/crossborder/payments?ref=', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });

  it('GET /crossborder/payments?ref=a/b → 400 (анти path-injection)', async () => {
    const r = await http.get('/crossborder/payments?ref=a%2Fb', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });

  it('GET /admin/tenants/own-sandbox → 200 без secretRef, со status', async () => {
    const view = await http.get('/admin/tenants/own-sandbox', {
      headers: admin,
    });
    expect(view.status).toBe(200);
    expect(view.data).not.toHaveProperty('secretRef');
    expect(typeof view.data.status).toBe('string');
  });

  it('POST /crossborder/payments с кривым Idempotency-Key → 400 (до MC)', async () => {
    const badKey = await http.post(
      '/crossborder/payments',
      {},
      { headers: { ...internal, 'idempotency-key': 'bad key!' } },
    );
    expect(badKey.status).toBe(400);
    expect(JSON.stringify(badKey.data)).toContain('Idempotency-Key');
  });

  it('POST /crossborder/address-validations (sandbox test case) → доходит до MC', async () => {
    // Sandbox Address Validation отдаёт статичные ответы на фикс. тест-кейсы.
    const r = await http.post(
      '/crossborder/address-validations',
      { country: 'USA', address: '4 CLARK STREET, EVERETT, MA, 02149' },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   addr-val MC resp:', r.status, JSON.stringify(r.data));
    // Контракт шлюза: маршрут смонтирован, OAuth1-подпись поставлена, запрос ушёл
    // в MC и ответ проброшен. НЕ 404 (маршрут есть) и НЕ 500 (нет локального краша).
    // 200 со status — если sandbox-кейс поддержан; иначе проброс бизнес-ответа MC.
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/account-validations (sandbox IBAN test case) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/account-validations',
      { accountUri: { type: 'IBAN', value: 'FR070331234567890123456' } },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   acct-val MC resp:', r.status, JSON.stringify(r.data));
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/bank-lookups (sandbox test case) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/bank-lookups',
      {
        bank: {
          name: '*of Africa United Kingdom*SUC20004',
          country: 'GBR',
          bic: { type: null, value: null },
        },
      },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   bank-lookup MC resp:', r.status, JSON.stringify(r.data));
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/iban-generations (sandbox test case) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/iban-generations',
      {
        accountUri: { type: 'ban', value: '20041010050500013M02606' },
        country: 'FRA',
        branchCode: '2004101005',
        accountNo: '0500013026',
      },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   iban-gen MC resp:', r.status, JSON.stringify(r.data));
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('GET /crossborder/cash-pickup/countries (sandbox, GET — без шифрования) → доходит до MC', async () => {
    const r = await http.get(
      '/crossborder/cash-pickup/countries?cash_pickup_type=PANY',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   cash-pickup countries MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('GET /crossborder/endpoint-guide/specifications (sandbox, GET — без тела/шифрования) → доходит до MC', async () => {
    const r = await http.get(
      '/crossborder/endpoint-guide/specifications?payment_type=B2B&destination_country=PHL&destination_currency=PHP&destination_payment_instrument=BANK',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   endpoint-guide MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('GET /crossborder/rfi/requests/:id (sandbox стаб 33… → OPEN, GET — без шифрования) → доходит до MC', async () => {
    const r = await http.get(
      '/crossborder/rfi/requests/33000000-0000-0000-0000-000000000000',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   rfi retrieve MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/rfi/requests/:id (update — нужно шифрование) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/rfi/requests/33000000-0000-0000-0000-000000000000',
      { updateRequest: { sender: { firstName: 'John', lastName: 'Doe' } } },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   rfi update MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/rfi/documents (upload — нужно шифрование) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/rfi/documents',
      { uploadDocumentRequest: { fileName: 'proof.pdf', file: 'dGVzdA==' } },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   rfi upload MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('GET /crossborder/rfi/documents/:id (download magic-id с кодом ошибки 082000) → доходит до MC', async () => {
    const r = await http.get(
      '/crossborder/rfi/documents/10000000-0000-0000-0000-000000082000',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log(
      '   rfi download MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/rfi/documents с ~500KB файлом → НЕ 413 (route-scoped лимит тела)', async () => {
    // ~500KB base64 — выше глобального 256kb, но в пределах route-scoped 2mb.
    // Доказывает, что крупный документ доходит до MC, а не режется парсером (413).
    const bigFile = 'A'.repeat(500_000);
    const r = await http.post(
      '/crossborder/rfi/documents',
      { uploadDocumentRequest: { fileName: 'big.pdf', file: bigFile } },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   rfi upload(~500KB) MC resp:', r.status);
    expect(r.status).not.toBe(413);
    expect(r.status).not.toBe(500);
  });

  it('GET /crossborder/rates (Carded/FX Rate Pull — sandbox недоступен) → проводка шлюза (не 500)', async () => {
    // Carded Rate не поддерживается sandbox'ом (по доке MC) — успех недостижим;
    // проверяем лишь, что шлюз не падает внутренне, а доходит до MC и форвардит.
    // Pull у MC — GET (операция getFxRates, без тела); прежний POST убран.
    const r = await http.get('/crossborder/rates', {
      headers: internal,
    });
    // eslint-disable-next-line no-console
    console.log(
      '   carded-rate MC resp:',
      r.status,
      JSON.stringify(r.data).slice(0, 200),
    );
    expect(r.status).not.toBe(500);
  });
});
