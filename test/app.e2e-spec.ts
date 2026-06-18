/**
 * E2E против ЖИВОГО sandbox Mastercard. Поднимает реальное приложение на порту
 * 3999 (как dev-харнесс: bodyParser вручную, без глобального pipe),
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
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { AppModule } from '../src/harness/app.module';
import { TenantEntity } from '../src/tenants/entities/tenant.entity';
import { DEMO_TENANTS, seedTenants } from '../src/tenants/services/tenant.seed';

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
    });
    // как в main.ts: лимит тела (256kb + RFI-2mb для своего маршрута) задаётся
    // Nest middleware (AppModule.configure), не вручную.
    // как в main.ts: глобального pipe НЕТ — каждый контроллер несёт свой.
    await app.listen(PORT);

    // Demo tenants are NO LONGER seeded on startup (issue #5) — we add them explicitly for
    // e2e (the baseline `platform` is seeded by the dev-harness DevSeedService). own-sandbox — OWN/ACTIVE.
    await seedTenants(
      app.get<Repository<TenantEntity>>(getRepositoryToken(TenantEntity)),
      DEMO_TENANTS,
    );

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

  it('POST /crossborder/payments — без заголовка, идемпотентность по transaction_reference → доходит до MC', async () => {
    // Заголовка Idempotency-Key больше нет (issue #3): ключ идемпотентности теперь
    // выводится из transaction_reference в теле. Проверяем, что маршрут не падает
    // локально (пайпа нет) и доходит до MC (там платёж без KYC отклонится — но НЕ 404/500).
    const r = await http.post(
      '/crossborder/payments',
      { paymentrequest: { transaction_reference: `e2e-${Date.now()}` } },
      { headers: internal },
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/address-validations (FLE) → 200 VALID/VERIFIED', async () => {
    // Полный FLE round-trip ВЖИВУЮ: запрос шифруется Client Encryption ключом
    // (kid f031d600, приватный у MC), ответ MC расшифровывается нашим Mastercard
    // Encryption ключом (kid 75ea7e15, приватный у нас). Документированный sandbox
    // тест-адрес → статичный VALID/VERIFIED (Address Validation Service).
    const r = await http.post(
      '/crossborder/address-validations',
      { country: 'USA', address: '4 CLARK STREET, EVERETT, MA, 02149' },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   addr-val MC resp:', r.status, JSON.stringify(r.data));
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'VALID', verification: 'VERIFIED' });
  });

  it('POST /crossborder/account-validations (FLE) → 200 SUCCESS + bank match', async () => {
    // Документированный sandbox IBAN-кейс → SUCCESS "Valid IBAN Structure" с банком.
    const r = await http.post(
      '/crossborder/account-validations',
      { accountUri: { type: 'IBAN', value: 'FR070331234567890123456' } },
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   acct-val MC resp:', r.status, JSON.stringify(r.data));
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'SUCCESS' });
    expect(r.data?.accountMatch).toBeDefined();
  });

  it('POST /crossborder/bank-lookups (FLE) → 200 + bank data', async () => {
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
    expect(r.status).toBe(200);
    expect(r.data?.bankInfo?.banks).toBeDefined();
  });

  it('POST /crossborder/iban-generations (FLE) → 200 + generated IBAN', async () => {
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
    expect(r.status).toBe(200);
    expect(r.data?.ibanDetails?.accounts).toBeDefined();
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

  it('GET /crossborder/rfi/requests/:id — невалидный UUID → 400 локально, валидный → доходит до MC', async () => {
    // `request_id` ДОЛЖЕН быть валидным UUID по RFC-4122 (MC иначе → 062000). Теперь
    // это проверяет UuidParamPipe на ГРАНИЦЕ.
    // (1) Невалидный RFC-4122 (ниблы версии/варианта = 0) отсекается ДО MC → чистый
    //     локальный 400, без рейс-трипа (в теле НЕТ 062000 — запрос не уходил).
    const bad = await http.get(
      '/crossborder/rfi/requests/33000000-0000-0000-0000-000000000000',
      { headers: internal },
    );
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.data)).not.toContain('062000');
    // (2) Валидная v4-форма проходит pipe и формат MC. В sandbox partner-id
    //     `SANDBOX_1234567` НЕ онбординжен для RFI → MC 401 → шлюз маскирует в 502
    //     (внешний лимит sandbox, не баг). Главное — маршрут жив: НЕ 404/500.
    const ok = await http.get(
      '/crossborder/rfi/requests/33000000-0000-4000-8000-000000000000',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   rfi retrieve(valid uuid) MC resp:', ok.status);
    expect(ok.status).not.toBe(404);
    expect(ok.status).not.toBe(500);
  });

  it('POST /crossborder/rfi/requests/:id (update, валидный UUID) → доходит до MC', async () => {
    const r = await http.post(
      '/crossborder/rfi/requests/33000000-0000-4000-8000-000000000000',
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

  it('GET /crossborder/rfi/documents/:id (download, валидный UUID) → доходит до MC', async () => {
    const r = await http.get(
      '/crossborder/rfi/documents/10000000-0000-4000-8000-000000082000',
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
