/**
 * E2E against the LIVE Mastercard sandbox. Brings up the real application on port
 * 3999 (like the dev harness: bodyParser set up manually, no global pipe),
 * runs HTTP checks via axios and closes. Requires: a running Postgres
 * (docker compose up -d) and a valid .env with sandbox credentials.
 *
 *   npm run test:e2e
 *
 * These are NOT unit tests (jest does not pick them up by default — a separate config
 * test/jest-e2e.json, testRegex .e2e-spec.ts$). MC network calls → a long
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
    // as in main.ts: the body limit (256kb + RFI-2mb for its route) is set by
    // Nest middleware (AppModule.configure), not manually.
    // as in main.ts: there is NO global pipe — each controller carries its own.
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

  it('POST /crossborder/quotes (passthrough) → 200 with proposal/charged_amount', async () => {
    const q = await http.post('/crossborder/quotes', quoteBody(), {
      headers: internal,
    });
    expect([200, 201]).toContain(q.status);
    const s = JSON.stringify(q.data);
    expect(s.includes('proposal') || s.includes('charged_amount')).toBe(true);
  });

  it('POST /crossborder/quotes with amount=number → 400 (DTO @IsString)', async () => {
    const bad = quoteBody();
    // @ts-expect-error intentionally break the amount type: a number instead of a string
    bad.quoterequest.payment_amount.amount = 105.15;
    const qb = await http.post('/crossborder/quotes', bad, {
      headers: internal,
    });
    expect(qb.status).toBe(400);
  });

  it('POST /admin/tenants OWN without secretRef → 400 (@ValidateIf)', async () => {
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

  it('POST /webhooks/mastercard/webhook without a token → 401 (fail-closed)', async () => {
    const wh = await http.post('/webhooks/mastercard/webhook', { eventRef: 'x' });
    expect(wh.status).toBe(401);
  });

  it('POST /webhooks/mastercard/webhook with a token → 200', async () => {
    const wh = await http.post(
      '/webhooks/mastercard/webhook',
      { eventRef: `e2e-${Date.now()}`, eventType: 'STATUS_CHG' },
      { headers: { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' } },
    );
    expect(wh.status).toBe(200);
  });

  it('GET /crossborder/payments?ref= (empty) → 400 (SafeIdPipe)', async () => {
    const r = await http.get('/crossborder/payments?ref=', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });

  it('GET /crossborder/payments?ref=a/b → 400 (anti path-injection)', async () => {
    const r = await http.get('/crossborder/payments?ref=a%2Fb', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });

  it('GET /admin/tenants/own-sandbox → 200 without secretRef, with status', async () => {
    const view = await http.get('/admin/tenants/own-sandbox', {
      headers: admin,
    });
    expect(view.status).toBe(200);
    expect(view.data).not.toHaveProperty('secretRef');
    expect(typeof view.data.status).toBe('string');
  });

  it('POST /crossborder/payments — no header, idempotency by transaction_reference → reaches MC', async () => {
    // The Idempotency-Key header is gone (issue #3): the idempotency key is now derived
    // from transaction_reference in the body. We check that the route does not fail
    // locally (no pipe) and reaches MC (a payment without KYC is rejected there — but NOT 404/500).
    const r = await http.post(
      '/crossborder/payments',
      { paymentrequest: { transaction_reference: `e2e-${Date.now()}` } },
      { headers: internal },
    );
    expect(r.status).not.toBe(404);
    expect(r.status).not.toBe(500);
  });

  it('POST /crossborder/address-validations (FLE) → 200 VALID/VERIFIED', async () => {
    // Full FLE round-trip LIVE: the request is encrypted with the Client Encryption key
    // (kid f031d600, private at MC), MC's response is decrypted with our Mastercard
    // Encryption key (kid 75ea7e15, private to us). The documented sandbox
    // test address → a static VALID/VERIFIED (Address Validation Service).
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
    // The documented sandbox IBAN case → SUCCESS "Valid IBAN Structure" with a bank.
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

  it('GET /crossborder/cash-pickup/countries (sandbox, GET — no encryption) → reaches MC', async () => {
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

  it('GET /crossborder/endpoint-guide/specifications (sandbox, GET — no body/encryption) → reaches MC', async () => {
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

  it('GET /crossborder/rfi/requests/:id — invalid UUID → 400 locally, valid → reaches MC', async () => {
    // `request_id` MUST be a valid RFC-4122 UUID (otherwise MC → 062000). This is now
    // checked by UuidParamPipe at the BOUNDARY.
    // (1) An invalid RFC-4122 (version/variant nibbles = 0) is rejected BEFORE MC → a clean
    //     local 400, no round-trip (the body has NO 062000 — the request never left).
    const bad = await http.get(
      '/crossborder/rfi/requests/33000000-0000-0000-0000-000000000000',
      { headers: internal },
    );
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.data)).not.toContain('062000');
    // (2) A valid v4 form passes the pipe and MC's format. In sandbox the partner-id
    //     `SANDBOX_1234567` is NOT onboarded for RFI → MC 401 → the gateway masks it as 502
    //     (an external sandbox limit, not a bug). The point — the route is alive: NOT 404/500.
    const ok = await http.get(
      '/crossborder/rfi/requests/33000000-0000-4000-8000-000000000000',
      { headers: internal },
    );
    // eslint-disable-next-line no-console
    console.log('   rfi retrieve(valid uuid) MC resp:', ok.status);
    expect(ok.status).not.toBe(404);
    expect(ok.status).not.toBe(500);
  });

  it('POST /crossborder/rfi/requests/:id (update, valid UUID) → reaches MC', async () => {
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

  it('POST /crossborder/rfi/documents (upload — needs encryption) → reaches MC', async () => {
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

  it('GET /crossborder/rfi/documents/:id (download, valid UUID) → reaches MC', async () => {
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

  it('POST /crossborder/rfi/documents with a ~500KB file → NOT 413 (route-scoped body limit)', async () => {
    // ~500KB base64 — above the global 256kb, but within the route-scoped 2mb.
    // Proves a large document reaches MC and is not cut by the parser (413).
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

  it('GET /crossborder/rates (Carded/FX Rate Pull — sandbox unavailable) → gateway plumbing (not 500)', async () => {
    // Carded Rate is not supported by the sandbox (per the MC docs) — success is unreachable;
    // we only check that the gateway does not fail internally but reaches MC and forwards.
    // Pull at MC is a GET (the getFxRates operation, no body); the former POST was removed.
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
