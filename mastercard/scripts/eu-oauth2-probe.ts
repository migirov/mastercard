/**
 * Stage-0 spike: discover how OAuth2 "Request Token" auth actually behaves on the
 * Mastercard Cross-Border PSD2 EU edge, BEFORE touching any production code.
 *
 * Target: https://sandbox.api.xbs.mastercard.eu (the real EU host — note the `xbs`
 * segment; `sandbox.api.mastercard.eu` without it is a dead legacy edge whose TLS
 * cert expired 2024-01-26).
 *
 * Token spec (docs/en/mc-oauth2/xbs-request-token-spec.md): a self-signed JWT sent
 * in the `Authorization` header. Grant type OAUTH2_REQUEST_TOKEN, "one-legged" —
 * no token endpoint, no DPoP. JOSE header: x5t#S256, x5c, kid (=consumer key),
 * cty=JWS, typ=JWT, alg=RS256. Claims: nbf, exp, iat, jti.
 *
 * Every request/response is written to reports/eu-oauth2-probe-<ts>/raw/ so the
 * output can be attached verbatim to a Mastercard support ticket.
 *
 *   npm run eu-probe
 *   npm run eu-probe -- --host=https://sandbox.api.xbs.mastercard.uk
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadSigningMaterialFromP12 } from '../src/common/utils/p12.util';
import { mintRequestToken } from '../src/mastercard/auth/utils/request-token.util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const oauth = require('mastercard-oauth1-signer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JweEncryption } = require('mastercard-client-encryption');

const EU_HOST = 'https://sandbox.api.xbs.mastercard.eu';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} is not set`);
  return v;
}
function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

interface Probe {
  id: string;
  what: string;
  host: string;
  partnerId: string;
  headers: Record<string, string>;
  body: unknown;
  encrypted?: boolean;
}

interface Result extends Probe {
  http_status: number;
  reason_code?: string;
  description?: string;
  response_body: unknown;
  transport_error?: string;
  ms: number;
}

async function main(): Promise<void> {
  const euHost = (arg('host') ?? EU_HOST).replace(/\/+$/, '');
  const partnerId = env('MC_PARTNER_ID');
  const consumerKey = env('MC_CONSUMER_KEY');
  const mat = loadSigningMaterialFromP12(
    path.resolve(process.cwd(), env('MC_SIGNING_KEY_PATH')),
    env('MC_SIGNING_KEY_PASSWORD'),
  );

  const outDir = path.resolve(
    process.cwd(),
    `reports/eu-oauth2-probe-${Date.now()}`,
  );
  const rawDir = path.join(outDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  console.log(`Host        : ${euHost}`);
  console.log(`Partner     : ${partnerId}`);
  console.log(`x5t#S256    : ${mat.certThumbprintS256}`);
  console.log(`Output      : ${outDir}\n`);

  const quotePath = (pid: string) =>
    `/send/v1/partners/${encodeURIComponent(pid)}/crossborder/quotes`;

  const quoteBody = (ref: string) => ({
    quoterequest: {
      transaction_reference: ref,
      sender_account_uri: 'tel:+25406005',
      recipient_account_uri: 'tel:+254069832',
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type: { forward: { receiver_currency: 'GBP', fees_included: true } },
    },
  });

  const uniq = Date.now().toString();
  let n = 0;
  const results: Result[] = [];

  // Every probe needs its OWN transaction_reference: MC rejects a repeat with
  // "Duplicate Transaction Reference Number" AFTER authenticating, which would
  // otherwise be indistinguishable from an auth failure.
  let refSeq = 0;
  const nextRef = () => `08${uniq}${String(++refSeq).padStart(2, '0')}ACFQ`;

  async function run(p: Probe): Promise<Result> {
    const seq = ++n;
    const url = `${p.host}${quotePath(p.partnerId)}`;
    const t0 = Date.now();
    let status = 0;
    let data: unknown;
    let transportError: string | undefined;
    try {
      const res = await axios.post(url, JSON.stringify(p.body), {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...p.headers,
        },
        timeout: 30_000,
        validateStatus: () => true,
      });
      status = res.status;
      data = res.data;
    } catch (e) {
      transportError = (e as Error).message;
    }
    const err = (data as any)?.Errors?.Error?.[0] ?? (data as any)?.Errors?.Error;
    const result: Result = {
      ...p,
      headers: Object.fromEntries(
        Object.entries(p.headers).map(([k, v]) => [
          k,
          k.toLowerCase() === 'authorization' ? `${v.slice(0, 24)}…(${v.length} ch)` : v,
        ]),
      ),
      http_status: status,
      reason_code: err?.ReasonCode,
      description: err?.Description,
      response_body: data ?? null,
      transport_error: transportError,
      ms: Date.now() - t0,
    };
    results.push(result);
    fs.writeFileSync(
      path.join(rawDir, `${String(seq).padStart(2, '0')}-${p.id}.json`),
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(
      `[${String(seq).padStart(2, '0')}] ${p.id.padEnd(26)} HTTP ${String(status).padEnd(4)} ` +
        `${(result.reason_code ?? transportError ?? '—').padEnd(26)} ${result.description ?? ''}`,
    );
    return result;
  }

  const token = (over: Record<string, unknown> = {}) =>
    mintRequestToken({
      consumerKey,
      signingKeyPem: mat.privateKeyPem,
      certThumbprintS256: mat.certThumbprintS256,
      certPem: mat.certPem,
      ...over,
    });

  const jwtFull = await token();

  // ---- A: controls -------------------------------------------------------
  console.log('--- A: controls ---');
  const a0 = await run({
    id: 'A0-no-auth',
    what: 'no Authorization header — baseline error fingerprint',
    host: euHost,
    partnerId,
    headers: {},
    body: quoteBody(nextRef()),
  });

  // One body object: OAuth1 signs over the exact bytes that get sent, otherwise a
  // rejection would be a signature mismatch rather than "OAuth1 is not accepted".
  const a1Body = quoteBody(nextRef());
  const oauth1Header = oauth.getAuthorizationHeader(
    `${euHost}${quotePath(partnerId)}`,
    'POST',
    JSON.stringify(a1Body),
    consumerKey,
    mat.privateKeyPem,
  );
  await run({
    id: 'A1-oauth1-on-eu',
    what: 'todays OAuth1 header verbatim — if 2xx, no OAuth2 needed at all',
    host: euHost,
    partnerId,
    headers: { Authorization: oauth1Header },
    body: a1Body,
  });

  // ---- B: Authorization header format ------------------------------------
  console.log('\n--- B: Authorization format (docs say only "as Authorization header") ---');
  await run({
    id: 'B1-bare-jwt',
    what: 'Authorization: <jwt>',
    host: euHost,
    partnerId,
    headers: { Authorization: jwtFull },
    body: quoteBody(nextRef()),
  });
  await run({
    id: 'B2-bearer-jwt',
    what: 'Authorization: Bearer <jwt>',
    host: euHost,
    partnerId,
    headers: { Authorization: `Bearer ${jwtFull}` },
    body: quoteBody(nextRef()),
  });

  // ---- C: JOSE header variants -------------------------------------------
  console.log('\n--- C: JOSE header variants ---');
  const jwtNoX5c = await token({ certPem: undefined });
  await run({
    id: 'C1-no-x5c',
    what: 'x5t#S256 only, no x5c chain (much smaller header)',
    host: euHost,
    partnerId,
    headers: { Authorization: jwtNoX5c },
    body: quoteBody(nextRef()),
  });
  const jwtShortKid = await token({ consumerKey: consumerKey.split('!')[0] });
  await run({
    id: 'C2-kid-before-bang',
    what: 'kid truncated at "!" instead of the full consumer key',
    host: euHost,
    partnerId,
    headers: { Authorization: jwtShortKid },
    body: quoteBody(nextRef()),
  });

  // ---- D: structural ------------------------------------------------------
  console.log('\n--- D: structural ---');
  await run({
    id: 'D1-token-reuse',
    what: 'same JWT sent a second time — is jti replay-checked?',
    host: euHost,
    partnerId,
    headers: { Authorization: jwtFull },
    body: quoteBody(nextRef()),
  });
  await run({
    id: 'D2-mc-sample-partner',
    what: "MC's own tutorial partner id BEL_MASEND5ged2",
    host: euHost,
    partnerId: 'BEL_MASEND5ged2',
    headers: {
      Authorization: await token(),
    },
    body: quoteBody(nextRef()),
  });

  // D4: encrypted payload, same FLE keys as .com
  if ((process.env.MC_ENCRYPTION_ENABLED ?? 'true').toLowerCase() === 'true') {
    const jwe = new JweEncryption({
      paths: [
        {
          path: '/crossborder',
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
    const encBody = jwe.encrypt('/crossborder', {}, quoteBody(nextRef())).body;
    await run({
      id: 'D4-encrypted-payload',
      what: 'same FLE keys as .com, x-encrypted: true',
      host: euHost,
      partnerId,
      encrypted: true,
      headers: {
        Authorization: await token(),
        'x-encrypted': 'true',
      },
      body: encBody,
    });
  }

  // ---- summary ------------------------------------------------------------
  const fingerprint = (r: Result) => `${r.http_status}/${r.reason_code ?? '-'}`;
  const base = fingerprint(a0);
  console.log(`\n=== Diff against A0 baseline (${base}) ===`);
  for (const r of results) {
    const fp = fingerprint(r);
    const moved = r.id === 'A0-no-auth' ? 'baseline' : fp === base ? 'same' : '>>> MOVED';
    console.log(`  ${r.id.padEnd(26)} ${fp.padEnd(28)} ${moved}`);
  }

  fs.writeFileSync(
    path.join(outDir, 'summary.json'),
    JSON.stringify(
      {
        host: euHost,
        partnerId,
        baseline: base,
        cert: { x5tS256: mat.certThumbprintS256 },
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nsummary → ${path.join(outDir, 'summary.json')}`);
  console.log(
    'Reading the result: a status/ReasonCode DIFFERENT from the A0 baseline means MC ' +
      'actually parsed the token — that is the signal we are hunting, not necessarily a 2xx.',
  );
}

main().catch((e) => {
  console.error('Probe failed:', e.message);
  process.exit(1);
});
