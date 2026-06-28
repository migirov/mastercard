/**
 * HERMETIC e2e (the CI default). Brings up the whole application, but MastercardClient and
 * CredentialsService are replaced with stubs — it does NOT call the live MC and does NOT
 * require real certs/p12. This lets us deterministically test the response-mapping branches
 * that the live suite (app.e2e-spec.ts) structurally CANNOT reach:
 * MC 401/5xx → 502 (body hidden), MC 4xx-object → the single envelope with `upstream`,
 * MC 4xx-non-object (HTML) → 502, success → the response shape. Plus input validation.
 *
 * Needs only Postgres (seeds/idempotency/dedup/audit) + a dev .env (dummy secrets). Run:
 *   node node_modules\jest\bin\jest.js --config ./test/jest-e2e.json
 * The live sandbox suite is separate: --config ./test/jest-e2e-live.json.
 */
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { AppModule } from '../src/harness/app.module';
import { CredentialsService } from '../src/credentials/services/credentials.service';
import { MastercardClient } from '../src/mastercard/services/mastercard-client.service';
import { TenantEntity } from '../src/tenants/entities/tenant.entity';
import { DEMO_TENANTS, seedTenants } from '../src/tenants/services/tenant.seed';

const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;

// Controllable MC stub: the test sets the next response (or a throw) before the call.
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
    });
    // Body limits (256kb global + RFI 2mb for its route) come from Nest middleware
    // (AppModule.configure), not manual app.use.
    await app.listen(PORT);

    // Demo tenants are NO LONGER seeded on startup (issue #5) — we add them explicitly for
    // e2e (the baseline `platform` is seeded by the dev-harness DevSeedService). acme — PLATFORM/ACTIVE.
    await seedTenants(
      app.get<Repository<TenantEntity>>(getRepositoryToken(TenantEntity)),
      DEMO_TENANTS,
    );

    http = axios.create({ baseURL: BASE, validateStatus: () => true });
    // acme — demo PLATFORM/ACTIVE; creds resolved by the stub (no certs).
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

  /**
   * A PLATFORM tenant (acme) may read a pooled status event ONLY for a payment it OWNS
   * (ownership-gated isolation — the shared pool is keyed by a guessable transaction_reference).
   * This establishes that ownership by initiating a payment for `ref`, which writes the
   * payment_idempotency record the pool read is authorized against. The stubbed MC succeeds.
   */
  async function claimRefAsPlatform(ref: string): Promise<void> {
    stubMc.shouldThrow = false;
    stubMc.next = { status: 200, data: { ok: true } };
    const r = await http.post(
      '/crossborder/payments',
      { paymentrequest: { transaction_reference: ref } },
      { headers: internal },
    );
    expect(r.status).toBe(201);
  }

  // --- response-mapping branches (the live suite cannot reach them) ---

  it('MC 2xx → data to the merchant as-is', async () => {
    stubMc.next = { status: 200, data: { accounts: [{ id: 'a' }] } };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ accounts: [{ id: 'a' }] });
  });

  it('MC business 4xx (object) → 422 with the single envelope and an upstream body', async () => {
    const mcBody = { Errors: { Error: { ReasonCode: 'DECLINE' } } };
    stubMc.next = { status: 422, data: mcBody };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(422);
    expect(r.data.error).toBe('Upstream Error');
    expect(r.data.upstream).toEqual(mcBody);
  });

  it('MC 401 → 502, the body/details do NOT leak', async () => {
    stubMc.next = { status: 401, data: { secret: 'internal-cred-detail' } };
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.data)).not.toContain('internal-cred-detail');
  });

  it('MC 4xx with a NON-object body (HTML) → 502 (not forwarded)', async () => {
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

  it('a network failure to MC → 502', async () => {
    stubMc.shouldThrow = true;
    const r = await http.get('/crossborder/balances', { headers: internal });
    expect(r.status).toBe(502);
  });

  // --- input validation (before MC; deterministic, no network) ---

  it('POST /crossborder/quotes amount=number → 400 (Passthrough preset DTO)', async () => {
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

  it('POST /webhooks/mastercard/webhook without a token → 401 (fail-closed)', async () => {
    const r = await http.post('/webhooks/mastercard/webhook', { eventType: 'noop' });
    expect(r.status).toBe(401);
  });

  it('GET /crossborder/payments?ref=a/b → 400 (SafeIdPipe anti-injection)', async () => {
    const r = await http.get('/crossborder/payments?ref=a%2Fb', {
      headers: internal,
    });
    expect(r.status).toBe(400);
  });

  // --- newer endpoints (coverage completion) ---

  it('GET /crossborder/rates (Carded/FX Rate Pull) → MC 2xx is forwarded', async () => {
    stubMc.next = { status: 200, data: { rates: [{ rate_id: 'r1' }] } };
    const r = await http.get('/crossborder/rates', { headers: internal });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ rates: [{ rate_id: 'r1' }] });
    // the path and method sent to MC (Pull = GET, no body)
    const sent = stubMc.request.mock.calls.at(-1)?.[1];
    expect(sent).toMatchObject({ method: 'GET' });
    expect(sent.path).toContain('/crossborder/rates');
  });

  it('POST /crossborder/quotes/cancellations → MC 2xx is forwarded', async () => {
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

  it('GET /crossborder/quotes/:ref/proposals/:id (Retrieve Confirmed Quote) → MC 2xx is forwarded', async () => {
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

  it('POST /crossborder/payments — idempotency by transaction_reference (Postgres, no KV)', async () => {
    const ref = `E2EIDEM_${Date.now()}`;
    const body = { paymentrequest: { transaction_reference: ref } };

    // 1) first payment → reaches MC, the result is cached in payment_idempotency
    stubMc.next = { status: 200, data: { paymentId: 'PAY1' } };
    const before = stubMc.request.mock.calls.length;
    const p1 = await http.post('/crossborder/payments', body, {
      headers: internal,
    });
    expect(p1.status).toBe(201);
    expect(p1.data).toEqual({ paymentId: 'PAY1' });
    expect(stubMc.request.mock.calls.length).toBe(before + 1);

    // 2) retry with the same ref+body → return the CACHE from Postgres, MC NOT called again
    stubMc.next = { status: 200, data: { paymentId: 'MUST_NOT_LEAK' } };
    const p2 = await http.post('/crossborder/payments', body, {
      headers: internal,
    });
    expect(p2.status).toBe(201);
    expect(p2.data).toEqual({ paymentId: 'PAY1' }); // cache, not a new MC response
    expect(stubMc.request.mock.calls.length).toBe(before + 1); // MC not called a second time

    // 3) same ref, DIFFERENT body → 422 (protects against payment swap), MC not called
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

  it('Status Change Push: webhook → persist to tx_status → polling → dedup (no MC)', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    // Unique ref/eventRef per run — tx_status is persistent between runs.
    const ref = `E2ETX_${Date.now()}`;
    const eventRef = `whe2e_${Date.now()}`;
    const body = {
      eventRef,
      eventType: 'STATUS_CHG',
      transactionReference: ref,
      partnerId: 'NOT_AN_OWN_PARTNER', // no OWN tenant → the shared pool (tenantId=null)
      transactionType: 'PAYMENT',
      quote: { confirmStatus: { status: 'CONFIRMED' } },
    };

    // 1) receive + atomic persist
    const post1 = await http.post('/webhooks/mastercard/webhook', body, {
      headers: webhook,
    });
    expect(post1.status).toBe(200);
    expect(post1.data).toEqual({ status: 'accepted' });

    // acme (PLATFORM) must OWN the payment to read its pooled status (ownership-gated).
    await claimRefAsPlatform(ref);

    // 2) polling by the merchant (acme = PLATFORM, owns ref → sees the shared-pool event)
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
    // view-DTO whitelist: internal fields are NOT exposed outward
    expect(poll.data[0].id).toBeUndefined();
    expect(poll.data[0].tenantId).toBeUndefined();
    expect(poll.data[0].payload).toBeDefined();

    // 3) MC retry of the same eventRef → duplicate (dedup = UNIQUE(eventRef))
    const post2 = await http.post('/webhooks/mastercard/webhook', body, {
      headers: webhook,
    });
    expect(post2.data).toEqual({ status: 'duplicate' });
  });

  it('encrypted push → persist BEFORE ack (200 accepted); retry of the same → duplicate', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    // A unique "ciphertext" per run (tx_status persists between runs).
    const body = { encrypted_payload: { data: `E2EENC_${Date.now()}` } };

    // Decryption is wired (kid routing), but this dummy ciphertext has no valid kid/key → it
    // cannot be decrypted, so the envelope is persisted BEFORE the ack (no loss).
    const post1 = await http.post('/webhooks/mastercard/webhook', body, {
      headers: webhook,
    });
    expect(post1.status).toBe(200);
    expect(post1.data).toEqual({ status: 'accepted' });

    // Retry of the identical envelope → dedup by enc:sha256(data) (= proves the first one
    // was stored) → duplicate, also 200.
    const post2 = await http.post('/webhooks/mastercard/webhook', body, {
      headers: webhook,
    });
    expect(post2.status).toBe(200);
    expect(post2.data).toEqual({ status: 'duplicate' });
  });

  it('attribution/isolation: OWN sees its own; PLATFORM sees a pooled ref only if it OWNS it; cross-tenant — no', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    // own-demo — an OWN seed with partnerId='OWN_PARTNER_TBD' (see TenantRegistry).
    const ownInternal = {
      'x-internal-token': process.env.MC_INTERNAL_TOKEN ?? '',
      'x-tenant-id': 'own-demo',
    };
    const t = Date.now();
    const refOwn = `E2EOWN_${t}`;
    const refPool = `E2EPOOL_${t}`;

    // A: partnerId matches an OWN tenant → attributed to own-demo
    const a = await http.post(
      '/webhooks/mastercard/webhook',
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
    // B: unknown partnerId → the shared pool (tenantId=null)
    const b = await http.post(
      '/webhooks/mastercard/webhook',
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

    // OWN sees its own event; PLATFORM (acme) does NOT (it is not in the pool)
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

    // OWN does NOT see the shared pool (strict attribution by partnerId)
    const ownSeesPool = await http.get(
      `/crossborder/status-events?ref=${refPool}`,
      { headers: ownInternal },
    );
    expect(ownSeesPool.data).toHaveLength(0);
    // PLATFORM that does NOT own refPool sees nothing — no cross-tenant pool read by guessing a ref
    const platNoOwn = await http.get(
      `/crossborder/status-events?ref=${refPool}`,
      { headers: internal },
    );
    expect(platNoOwn.data).toHaveLength(0);
    // …but once acme OWNS that ref (it initiated the payment), it may read its pooled status
    await claimRefAsPlatform(refPool);
    const platSeesPool = await http.get(
      `/crossborder/status-events?ref=${refPool}`,
      { headers: internal },
    );
    expect(platSeesPool.data).toHaveLength(1);
  });

  it('overlong status (uncapped MC field) — stored in full, 200 not 500', async () => {
    const webhook = { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' };
    const t = Date.now();
    const ref = `E2ETRUNC_${t}`;
    const longStatus = 'S'.repeat(50); // status isn't DTO length-capped
    const post = await http.post(
      '/webhooks/mastercard/webhook',
      {
        eventRef: `whtrunc_${t}`,
        eventType: 'STATUS_CHG',
        transactionReference: ref,
        partnerId: 'NOBODY',
        transactionType: 'PAYMENT',
        quote: { confirmStatus: { status: longStatus } },
      },
      { headers: webhook },
    );
    expect(post.status).toBe(200);
    expect(post.data).toEqual({ status: 'accepted' });

    await claimRefAsPlatform(ref); // acme must own the ref to read its pooled status
    const poll = await http.get(`/crossborder/status-events?ref=${ref}`, {
      headers: internal,
    });
    expect(poll.data).toHaveLength(1);
    // `status` is a `text` column → no width to overflow, no truncation: an overlong
    // value is stored verbatim and the webhook still returns 200 (never a 500).
    expect(poll.data[0].status).toBe(longStatus);
  });
});
