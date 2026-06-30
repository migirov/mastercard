/**
 * Phase 4 PoC: JWE field-level encryption on sandbox.
 * Verifies the round-trip: encrypt the quote → sign → send with
 * x-encrypted:true → decrypt the response.
 *
 *   npm run encrypt-poc
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadPrivateKeyFromP12 } from '../src/common/utils/p12.util';
// Mastercard CommonJS packages
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const oauth = require('mastercard-oauth1-signer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JweEncryption } = require('mastercard-client-encryption');

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} is not set`);
  return v;
}

async function main() {
  const baseUrl = env('MC_BASE_URL').replace(/\/+$/, '');
  const partnerId = env('MC_PARTNER_ID');
  const consumerKey = env('MC_CONSUMER_KEY');
  const signingKeyPem = loadPrivateKeyFromP12(
    env('MC_SIGNING_KEY_PATH'),
    env('MC_SIGNING_KEY_PASSWORD'),
  );

  // Private decryption key from the .p12 → a temporary PEM (no alias needed).
  // Encrypting the request does NOT need it (only the public cert), so on a password
  // failure we fall back to a throwaway key just for the constructor and test
  // encryption-only.
  let canDecrypt = true;
  let decryptPem: string;
  try {
    decryptPem = loadPrivateKeyFromP12(
      env('MC_ENCRYPTION_KEY_PATH'),
      env('MC_ENCRYPTION_KEY_PASSWORD'),
    );
  } catch (e) {
    canDecrypt = false;
    console.log(`⚠️  Decryption key did not open: ${(e as Error).message}`);
    console.log(
      '   → ENCRYPTION-only test; response decryption unavailable ' +
        '(needs the correct MC_ENCRYPTION_KEY_PASSWORD).',
    );
    decryptPem = require('crypto').generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
  }
  const tmpKey = path.resolve(process.cwd(), 'certs/.poc-decrypt-key.pem');
  fs.writeFileSync(tmpKey, decryptPem, { mode: 0o600 });

  const endpointPath = '/crossborder/quotes';
  const jwe = new JweEncryption({
    paths: [
      {
        path: endpointPath,
        toEncrypt: [{ element: '$', obj: 'encrypted_payload' }],
        toDecrypt: [{ element: 'encrypted_payload', obj: '$' }],
      },
    ],
    mode: 'JWE',
    encryptedValueFieldName: 'data',
    encryptionCertificate: path.resolve(
      process.cwd(),
      env('MC_ENCRYPTION_CERT_PATH'),
    ),
    privateKey: tmpKey,
    publicKeyFingerprint: env('MC_ENCRYPTION_FINGERPRINT').toLowerCase(),
  });

  // Sample forward-quote (sandbox success test: tx ref '08…ACFQ').
  const payload = {
    quoterequest: {
      transaction_reference: '08POC000000000ACFQ',
      sender_account_uri: 'tel:+25406005',
      recipient_account_uri: 'tel:+254069832',
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type: { forward: { receiver_currency: 'GBP' } },
    },
  };

  const plainMode = process.argv.includes('plain');

  // 1) Encrypt (or leave as-is in plain mode for comparison).
  // Body: either the original payload (quoterequest) or MC's encrypted envelope.
  let encBody: {
    quoterequest?: unknown;
    encrypted_payload?: { data?: unknown };
  } = payload;
  if (!plainMode) {
    encBody = jwe.encrypt(endpointPath, {}, payload).body;
    console.log('--- Encrypted body (structure) ---');
    console.log(JSON.stringify(encBody).slice(0, 220) + ' …');
    const hasShape =
      encBody?.encrypted_payload?.data &&
      typeof encBody.encrypted_payload.data === 'string';
    console.log(
      hasShape
        ? '✅ structure { encrypted_payload: { data: <JWE> } } — correct'
        : '❌ structure did not match the expected one',
    );
  } else {
    console.log('--- PLAIN mode: no encryption, no x-encrypted ---');
  }

  // 2) Sign and send.
  const url = `${baseUrl}/send/v1/partners/${partnerId}/crossborder/quotes`;
  const bodyStr = JSON.stringify(encBody);
  const authHeader = oauth.getAuthorizationHeader(
    url,
    'POST',
    bodyStr,
    consumerKey,
    signingKeyPem,
  );

  console.log(`\n--- POST ${url} (x-encrypted:true) ---`);
  const res = await axios.post(url, bodyStr, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(plainMode ? {} : { 'x-encrypted': 'true' }),
    },
    validateStatus: () => true,
  });
  console.log(`HTTP ${res.status}`);
  console.log(`x-encrypted (resp): ${res.headers['x-encrypted'] ?? '—'}`);
  const respStr =
    typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  console.log('Response body: ' + respStr.slice(0, 400));

  // 3) Try to decrypt if the response is encrypted (and the key is available).
  if (res.data?.encrypted_payload?.data && !canDecrypt) {
    console.log(
      '\n⚠️  The response is encrypted, but decryption was skipped — needs the ' +
        'correct MC_ENCRYPTION_KEY_PASSWORD.',
    );
  }
  if (res.data?.encrypted_payload?.data && canDecrypt) {
    try {
      const decrypted = jwe.decrypt({
        request: { url: endpointPath },
        body: res.data,
      });
      console.log('\n✅ Response decrypted:');
      console.log(JSON.stringify(decrypted).slice(0, 500));
    } catch (e) {
      console.log(`\n❌ Decryption failed: ${(e as Error).message}`);
    }
  }

  fs.rmSync(tmpKey, { force: true });
}

main().catch((e) => {
  console.error('PoC failed:', e.message);
  process.exit(1);
});
