/**
 * Sandbox connectivity run for the Mastercard technical-connectivity report.
 *
 * Fires Quote and Payment calls straight at the Mastercard sandbox — no gateway,
 * no BFF, no database — and records the COMPLETE request/response payloads
 * (decrypted) under reports/<run>/raw/. Going direct matters: the gateway masks
 * upstream 401/403/5xx as a bodiless 502 and never logs response bodies, and the
 * BFF silently substitutes demo data when a live call fails.
 *
 * Crypto/signing mirrors the runtime exactly (see src/mastercard/services/
 * mc-interceptors.ts): encrypt the body first, then OAuth1-sign the encrypted body.
 *
 *   npm run sandbox-report -- --smoke     credential check only (GET accounts)
 *   npm run sandbox-report                the full Quote + Payment run
 *   npm run sandbox-report -- --base-url=https://sandbox.api.mastercard.com
 */
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';
import { loadSigningMaterialFromP12 } from '../src/common/utils/p12.util';
import { mintRequestToken } from '../src/mastercard/auth/utils/request-token.util';
import { McAuthMode } from '../src/mastercard/auth/mc-auth.types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const oauth = require('mastercard-oauth1-signer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JweEncryption } = require('mastercard-client-encryption');

/** Path-config key for the JWE config — the same constant the runtime uses. */
const ENDPOINT = '/crossborder';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} is not set`);
  return v;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/**
 * Pull the proposal id out of a quote response. MC nests it at
 * `quote.proposals.proposal[].id` (the field is `id`, not `proposal_id`); the
 * recursive fallback also accepts a literal `proposal_id` elsewhere.
 */
function findProposalId(node: unknown): string | undefined {
  const proposal = (node as any)?.quote?.proposals?.proposal;
  const first = Array.isArray(proposal) ? proposal[0] : proposal;
  if (typeof first?.id === 'string' && first.id) return first.id;

  if (!node || typeof node !== 'object') return undefined;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if ((k === 'proposal_id' || k === 'id') && typeof v === 'string' && v) {
      return v;
    }
    const nested = findProposalId(v);
    if (nested) return nested;
  }
  return undefined;
}

interface CallRecord {
  seq: number;
  api: string;
  scenario: string;
  transaction_reference?: string;
  method: string;
  url: string;
  request_headers: Record<string, string>;
  request_payload_plain: unknown;
  request_encrypted: boolean;
  http_status: number;
  response_headers: Record<string, string>;
  response_payload_raw: unknown;
  response_payload: unknown;
  response_was_encrypted: boolean;
  timestamp_utc: string;
  duration_ms: number;
  error?: string;
}

class Runner {
  private readonly records: CallRecord[] = [];
  private seq = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly partnerId: string,
    private readonly consumerKey: string,
    private readonly signingKeyPem: string,
    private readonly jwe: unknown,
    private readonly encryptionEnabled: boolean,
    private readonly rawDir: string,
    private readonly authMode: 'oauth1' | 'oauth2-request-token',
    private readonly certThumbprintS256?: string,
    private readonly certPem?: string,
  ) {}

  get all(): CallRecord[] {
    return this.records;
  }

  async call(opts: {
    api: string;
    scenario: string;
    method: 'GET' | 'POST';
    path: string;
    body?: unknown;
    transactionReference?: string;
    slug: string;
  }): Promise<CallRecord> {
    const seq = ++this.seq;
    const url = `${this.baseUrl}${opts.path}`;
    const startedAt = new Date();
    const t0 = Date.now();

    // 1) encrypt (JWE) — exactly as EncryptionService.encryptRequest does.
    // Snapshot the cleartext first: the MC library replaces the body's fields
    // in place, so without a copy the "plain" record would show the envelope.
    const plainSnapshot =
      opts.body == null ? null : JSON.parse(JSON.stringify(opts.body));
    let wireBody: unknown = opts.body;
    let encrypted = false;
    if (opts.body != null && this.encryptionEnabled) {
      wireBody = (this.jwe as any).encrypt(ENDPOINT, {}, opts.body).body;
      encrypted = true;
    }
    const payload = wireBody == null ? undefined : JSON.stringify(wireBody);

    // 2) authenticate over the FINAL (encrypted) body — the same two schemes the
    // runtime implements, so this report exercises the production mechanism rather
    // than a parallel one.
    const authHeader =
      this.authMode === 'oauth2-request-token'
        ? await mintRequestToken({
            consumerKey: this.consumerKey,
            signingKeyPem: this.signingKeyPem,
            certThumbprintS256: this.certThumbprintS256,
            certPem: this.certPem,
          })
        : oauth.getAuthorizationHeader(
            url,
            opts.method,
            payload,
            this.consumerKey,
            this.signingKeyPem,
          );
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: 'application/json',
      ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(encrypted ? { 'x-encrypted': 'true' } : {}),
    };

    let res: AxiosResponse | undefined;
    let error: string | undefined;
    try {
      res = await axios.request({
        url,
        method: opts.method,
        data: payload,
        headers,
        timeout: 30_000,
        validateStatus: () => true,
      });
    } catch (e) {
      error = (e as Error).message;
    }

    // 3) decrypt the response if enveloped. Snapshot the envelope first — the
    // library mutates the object it decrypts, so a live reference would not
    // survive as evidence of what arrived on the wire.
    const raw = res?.data;
    const rawSnapshot =
      raw == null ? undefined : JSON.parse(JSON.stringify(raw));
    let decrypted: unknown = raw;
    let wasEncrypted = false;
    if ((raw as any)?.encrypted_payload?.data) {
      wasEncrypted = true;
      try {
        decrypted = (this.jwe as any).decrypt({
          request: { url: ENDPOINT },
          body: raw,
        });
      } catch (e) {
        error = `response decryption failed: ${(e as Error).message}`;
      }
    }

    const record: CallRecord = {
      seq,
      api: opts.api,
      scenario: opts.scenario,
      transaction_reference: opts.transactionReference,
      method: opts.method,
      url,
      // Never record the credential itself (an OAuth1 signature or a request token).
      request_headers: { ...headers, Authorization: '<credential, redacted>' },
      request_payload_plain: plainSnapshot,
      request_encrypted: encrypted,
      http_status: res?.status ?? 0,
      response_headers: {
        'content-type': String(res?.headers?.['content-type'] ?? ''),
        'x-encrypted': String(res?.headers?.['x-encrypted'] ?? ''),
      },
      response_payload_raw: wasEncrypted ? rawSnapshot : undefined,
      response_payload: decrypted ?? null,
      response_was_encrypted: wasEncrypted,
      timestamp_utc: startedAt.toISOString(),
      duration_ms: Date.now() - t0,
      ...(error ? { error } : {}),
    };
    this.records.push(record);

    const file = path.join(
      this.rawDir,
      `${String(seq).padStart(2, '0')}-${opts.slug}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');

    const mark = record.http_status >= 200 && record.http_status < 300 ? 'OK ' : '!! ';
    console.log(
      `${mark}[${seq}] ${opts.api.padEnd(7)} ${opts.scenario.padEnd(34)} ` +
        `HTTP ${record.http_status} ${record.duration_ms}ms ` +
        `ref=${opts.transactionReference ?? '—'}${error ? ` err=${error}` : ''}`,
    );
    return record;
  }
}

/** Signed GET against both hosts — proves whether the EU edge is entitled. */
async function smoke(
  consumerKey: string,
  signingKeyPem: string,
  partnerId: string,
): Promise<void> {
  const testPath = (process.env.MC_TEST_PATH ??
    '/send/partners/{partner-id}/crossborder/accounts?include_balance=true'
  ).replace('{partner-id}', encodeURIComponent(partnerId));

  const hosts = (
    arg('hosts') ??
    'https://sandbox.api.mastercard.com,https://sandbox.api.eu.mastercard.com'
  ).split(',');

  for (const host of hosts) {
    const url = `${host}${testPath}`;
    try {
      const authHeader = oauth.getAuthorizationHeader(
        url,
        'GET',
        undefined,
        consumerKey,
        signingKeyPem,
      );
      const res = await axios.get(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeout: 30_000,
        validateStatus: () => true,
      });
      const body =
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`\n${host}\n  HTTP ${res.status}\n  ${body.slice(0, 600)}`);
    } catch (e) {
      console.log(`\n${host}\n  TRANSPORT ERROR: ${(e as Error).message}`);
    }
  }
}

async function main(): Promise<void> {
  const baseUrl = (arg('base-url') ?? env('MC_BASE_URL')).replace(/\/+$/, '');
  const partnerId = env('MC_PARTNER_ID');
  const consumerKey = env('MC_CONSUMER_KEY');
  const signing = loadSigningMaterialFromP12(
    path.resolve(process.cwd(), env('MC_SIGNING_KEY_PATH')),
    env('MC_SIGNING_KEY_PASSWORD'),
  );
  const signingKeyPem = signing.privateKeyPem;
  // Mirrors the runtime: the PSD2 edges take a request token, the global ones OAuth1.
  const authMode: McAuthMode =
    (arg('auth-mode') as McAuthMode | undefined) ??
    (process.env.MC_AUTH_MODE as McAuthMode | undefined) ??
    'oauth1';

  if (process.argv.includes('--smoke')) {
    console.log(`Credential smoke test (partner ${partnerId})`);
    await smoke(consumerKey, signingKeyPem, partnerId);
    return;
  }

  const encryptionEnabled =
    (process.env.MC_ENCRYPTION_ENABLED ?? 'true').toLowerCase() === 'true';
  // Key direction (do NOT invert): the public MC cert encrypts our REQUEST; our
  // private PEM decrypts the RESPONSE. Same pair the runtime uses.
  const jwe = new JweEncryption({
    paths: [
      {
        path: ENDPOINT,
        toEncrypt: [{ element: '$', obj: 'encrypted_payload' }],
        toDecrypt: [{ element: 'encrypted_payload', obj: '$' }],
      },
    ],
    mode: 'JWE',
    encryptedValueFieldName: 'data',
    useCertificateContent: false,
    encryptionCertificate: path.resolve(
      process.cwd(),
      env('MC_ENCRYPTION_CERT_PATH'),
    ),
    privateKey: path.resolve(process.cwd(), env('MC_DECRYPTION_KEY_PATH')),
    publicKeyFingerprint: env('MC_ENCRYPTION_FINGERPRINT').toLowerCase(),
  });

  const outDir = path.resolve(
    process.cwd(),
    arg('out') ?? 'reports/sandbox-connectivity-run',
  );
  const rawDir = path.join(outDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const p = encodeURIComponent(partnerId);
  const quotesPath = `/send/v1/partners/${p}/crossborder/quotes`;
  const paymentPath = `/send/v1/partners/${p}/crossborder/payment`;

  // Sandbox returns canned responses selected by transaction_reference (see
  // docs/en/api-mastercard.md "Sandbox Test cases"); references must be unique
  // per run, hence the epoch suffix.
  const uniq = Date.now().toString();
  const ref = {
    quoteForward: `08${uniq}ACFQ`,
    quoteReverse: `08${uniq}ACRQ`,
    paymentSuccess: `09${uniq}`,
    paymentPending: `06${uniq}`,
  };

  // Account URIs in the shapes Mastercard's own corridor samples use (see
  // docs/ru/additional/): an IBAN sender paying a bank account identified by
  // BIC. Earlier runs used `tel:` on both ends, which is a mobile-wallet shape
  // and told a reviewer nothing about the corridor.
  const SENDER_URI = 'iban:TR123456789012565';
  const RECIPIENT_URI = 'ban:0000123456001;bic=EQBLKENAXXX';
  // The PENDING sandbox case keys off the recipient URI's last 6 digits being
  // '10####', so that scenario keeps a `tel:` wallet URI (also a real shape —
  // MC's KEN-MW-SAFCOM sample pays a mobile wallet exactly this way).
  const RECIPIENT_URI_PENDING = 'tel:+254100123';

  /**
   * Corridor descriptors. Mastercard requires `701` (recipient country, ISO-3) and
   * `1200` (Destination Service Tag — the payout channel, `{COUNTRY}-{CHANNEL}`
   * where BK=bank, MW=mobile wallet, CA=cash) in `additional_data` on every real
   * transaction; the valid tags per corridor come from the Endpoint Guide API.
   */
  const corridor = {
    kenyaBank: { country: 'KEN', serviceTag: 'KEN-BK' },
    kenyaWallet: { country: 'KEN', serviceTag: 'KEN-MW-SAFCOM' },
  };

  const additionalData = (c: { country: string; serviceTag: string }) => ({
    data_field: [
      { name: '701', value: c.country },
      { name: '1200', value: c.serviceTag },
    ],
  });

  const sender = {
    first_name: 'John',
    middle_name: 'L',
    last_name: 'Doe',
    nationality: 'USA',
    address: {
      line1: '123MainStreet',
      line2: '5A',
      city: 'Arlington',
      country_subdivision: 'VA',
      postal_code: '22207',
      country: 'USA',
    },
    date_of_birth: '1985-06-24',
  };
  const recipient = {
    first_name: 'Lee',
    middle_name: 'M',
    last_name: 'Cardholder',
    nationality: 'USA',
    address: {
      line1: '123MainStreet',
      line2: '5A',
      city: 'Arlington',
      country_subdivision: 'VA',
      postal_code: '22207',
      country: 'USA',
    },
    phone: '0016367224357',
    email: 'customer@gmail.com',
  };

  const quoteBody = (
    transaction_reference: string,
    quote_type: unknown,
    recipientUri = RECIPIENT_URI,
    c = corridor.kenyaBank,
  ) => ({
    quoterequest: {
      transaction_reference,
      sender_account_uri: SENDER_URI,
      recipient_account_uri: recipientUri,
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type,
      additional_data: additionalData(c),
    },
  });

  console.log(`\nBase URL : ${baseUrl}`);
  console.log(`Partner  : ${partnerId}`);
  console.log(`Auth     : ${authMode}`);
  console.log(`Encrypt  : ${encryptionEnabled ? 'JWE enabled' : 'plain'}`);
  console.log(`Output   : ${outDir}\n`);

  const r = new Runner(
    baseUrl,
    partnerId,
    consumerKey,
    signingKeyPem,
    jwe,
    encryptionEnabled,
    rawDir,
    authMode,
    signing.certThumbprintS256,
    signing.certPem,
  );

  // 1) Forward quote, fees included → SUCCESS
  await r.call({
    api: 'Quote',
    scenario: 'Forward quote, fees included',
    method: 'POST',
    path: quotesPath,
    transactionReference: ref.quoteForward,
    slug: 'quote-forward',
    body: quoteBody(ref.quoteForward, {
      forward: { receiver_currency: 'GBP', fees_included: true },
    }),
  });

  // 2) Reverse quote → SUCCESS
  await r.call({
    api: 'Quote',
    scenario: 'Reverse quote',
    method: 'POST',
    path: quotesPath,
    transactionReference: ref.quoteReverse,
    slug: 'quote-reverse',
    body: quoteBody(ref.quoteReverse, { reverse: { sender_currency: 'USD' } }),
  });

  // 3) Quote that funds the successful payment (ref starts '09')
  const q3 = await r.call({
    api: 'Quote',
    scenario: 'Quote for payment (success flow)',
    method: 'POST',
    path: quotesPath,
    transactionReference: ref.paymentSuccess,
    slug: 'quote-for-payment-success',
    body: quoteBody(ref.paymentSuccess, {
      forward: { receiver_currency: 'GBP', fees_included: true },
    }),
  });
  const proposalSuccess = findProposalId(q3.response_payload);
  console.log(`    proposal_id → ${proposalSuccess ?? 'NOT FOUND'}`);

  // 4) Payment with quote → SUCCESS
  if (proposalSuccess) {
    await r.call({
      api: 'Payment',
      scenario: 'Payment with quote (success)',
      method: 'POST',
      path: paymentPath,
      transactionReference: ref.paymentSuccess,
      slug: 'payment-success',
      body: {
        paymentrequest: {
          transaction_reference: ref.paymentSuccess,
          proposal_id: proposalSuccess,
          sender_account_uri: SENDER_URI,
          recipient_account_uri: RECIPIENT_URI,
          receiving_bank_name: 'Royal Exchange',
          receiving_bank_branch_name: 'Quad Cities',
          // Present on every real corridor sample Mastercard publishes.
          purpose_of_payment: 'Family Maintenance',
          source_of_income: 'Salary',
          sender,
          recipient,
        },
      },
    });
  } else {
    console.log('!!  skipping payment (success): no proposal_id from quote');
  }

  // 5) Quote that funds the pending payment (ref starts '06')
  const q5 = await r.call({
    api: 'Quote',
    scenario: 'Quote for payment (pending flow)',
    method: 'POST',
    path: quotesPath,
    transactionReference: ref.paymentPending,
    slug: 'quote-for-payment-pending',
    body: quoteBody(
      ref.paymentPending,
      { forward: { receiver_currency: 'GBP', fees_included: true } },
      RECIPIENT_URI_PENDING,
      corridor.kenyaWallet,
    ),
  });
  const proposalPending = findProposalId(q5.response_payload);
  console.log(`    proposal_id → ${proposalPending ?? 'NOT FOUND'}`);

  // 6) Payment with quote → PENDING (recipient URI last 6 digits '10####')
  if (proposalPending) {
    await r.call({
      api: 'Payment',
      scenario: 'Payment with quote (pending)',
      method: 'POST',
      path: paymentPath,
      transactionReference: ref.paymentPending,
      slug: 'payment-pending',
      body: {
        paymentrequest: {
          transaction_reference: ref.paymentPending,
          proposal_id: proposalPending,
          sender_account_uri: SENDER_URI,
          recipient_account_uri: RECIPIENT_URI_PENDING,
          receiving_bank_name: 'Royal Exchange',
          receiving_bank_branch_name: 'Quad Cities',
          // Present on every real corridor sample Mastercard publishes.
          purpose_of_payment: 'Family Maintenance',
          source_of_income: 'Salary',
          sender,
          recipient,
        },
      },
    });
  } else {
    console.log('!!  skipping payment (pending): no proposal_id from quote');
  }

  const summary = {
    base_url: baseUrl,
    partner_id: partnerId,
    auth_mode: authMode,
    encryption: encryptionEnabled ? 'JWE (field-level)' : 'none',
    quotes_url: `${baseUrl}${quotesPath}`,
    payment_url: `${baseUrl}${paymentPath}`,
    run_started_utc: new Date(Number(uniq)).toISOString(),
    calls: r.all,
  };
  fs.writeFileSync(
    path.join(outDir, 'run-summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
  );

  const ok = r.all.filter((c) => c.http_status >= 200 && c.http_status < 300);
  console.log(`\n${ok.length}/${r.all.length} calls returned 2xx`);
  console.log(`Summary → ${path.join(outDir, 'run-summary.json')}`);
}

main().catch((e) => {
  console.error('Run failed:', e.message);
  process.exit(1);
});
