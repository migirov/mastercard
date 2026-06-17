/**
 * PoC Фазы 4: JWE field-level encryption на sandbox.
 * Проверяет round-trip: зашифровать quote → подписать → отправить с
 * x-encrypted:true → расшифровать ответ.
 *
 *   npm run encrypt-poc
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadPrivateKeyFromP12 } from '../src/common/utils/p12.util';
// CommonJS-пакеты Mastercard
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

  // Приватный ключ дешифрования из .p12 → временный PEM (alias не нужен).
  // Шифрование запроса его НЕ требует (только публичный cert), поэтому при сбое
  // пароля падаем на throwaway-ключ ради конструктора и тестируем encryption-only.
  let canDecrypt = true;
  let decryptPem: string;
  try {
    decryptPem = loadPrivateKeyFromP12(
      env('MC_ENCRYPTION_KEY_PATH'),
      env('MC_ENCRYPTION_KEY_PASSWORD'),
    );
  } catch (e) {
    canDecrypt = false;
    console.log(`⚠️  Ключ дешифрования не открылся: ${(e as Error).message}`);
    console.log(
      '   → тест только ШИФРОВАНИЯ; расшифровка ответа недоступна ' +
        '(нужен верный MC_ENCRYPTION_KEY_PASSWORD).',
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

  // 1) Шифруем (или оставляем как есть в plain-режиме для сравнения)
  // Тело: либо исходный payload (quoterequest), либо зашифрованный конверт MC.
  let encBody: {
    quoterequest?: unknown;
    encrypted_payload?: { data?: unknown };
  } = payload;
  if (!plainMode) {
    encBody = jwe.encrypt(endpointPath, {}, payload).body;
    console.log('--- Зашифрованное тело (структура) ---');
    console.log(JSON.stringify(encBody).slice(0, 220) + ' …');
    const hasShape =
      encBody?.encrypted_payload?.data &&
      typeof encBody.encrypted_payload.data === 'string';
    console.log(
      hasShape
        ? '✅ структура { encrypted_payload: { data: <JWE> } } — верно'
        : '❌ структура не совпала с ожидаемой',
    );
  } else {
    console.log('--- PLAIN режим: без шифрования, без x-encrypted ---');
  }

  // 2) Подписываем и шлём
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
  console.log('Тело ответа: ' + respStr.slice(0, 400));

  // 3) Пытаемся расшифровать, если ответ зашифрован (и ключ доступен)
  if (res.data?.encrypted_payload?.data && !canDecrypt) {
    console.log(
      '\n⚠️  Ответ зашифрован, но расшифровка пропущена — нужен верный ' +
        'MC_ENCRYPTION_KEY_PASSWORD.',
    );
  }
  if (res.data?.encrypted_payload?.data && canDecrypt) {
    try {
      const decrypted = jwe.decrypt({
        request: { url: endpointPath },
        body: res.data,
      });
      console.log('\n✅ Ответ расшифрован:');
      console.log(JSON.stringify(decrypted).slice(0, 500));
    } catch (e) {
      console.log(`\n❌ Расшифровка не удалась: ${(e as Error).message}`);
    }
  }

  fs.rmSync(tmpKey, { force: true });
}

main().catch((e) => {
  console.error('PoC упал:', e.message);
  process.exit(1);
});
