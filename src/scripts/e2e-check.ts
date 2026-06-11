/**
 * E2E-проверка после рефактора DTO/модуля. Поднимает приложение на порту 3999,
 * прогоняет набор HTTP-проверок (включая реальный вызов sandbox Mastercard) и
 * закрывается. Печатает PASS/FAIL по каждой проверке; exit 1, если есть провал.
 *
 *   npx ts-node src/scripts/e2e-check.ts
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import axios from 'axios';
import { AppModule } from '../app.module';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = ''): void {
  // eslint-disable-next-line no-console
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
}

async function main(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: false,
    rawBody: true,
  });
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '256kb' });
  // как в main.ts: глобального pipe НЕТ — каждый контроллер несёт свой.
  await app.listen(PORT);

  const internal = {
    'x-internal-token': process.env.MC_INTERNAL_TOKEN ?? '',
    'x-tenant-id': 'own-sandbox',
  };
  const admin = { 'x-admin-token': process.env.MC_ADMIN_TOKEN ?? '' };
  const http = axios.create({ baseURL: BASE, validateStatus: () => true });
  const ref = `08E2E${Date.now()}`;
  const quoteBody = {
    quoterequest: {
      transaction_reference: ref,
      sender_account_uri: 'tel:+25406005',
      recipient_account_uri: 'tel:+254069832',
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type: { forward: { receiver_currency: 'GBP' } },
    },
  };

  try {
    // 1) balances — реальный sandbox-вызов, путь auth=internal
    const bal = await http.get('/crossborder/balances', { headers: internal });
    check('GET /crossborder/balances (sandbox)', bal.status === 200, `HTTP ${bal.status}`);

    // 2) quote — passthrough-pipe НЕ должен испортить суммы-строки; ждём 200/201 с proposal
    const q = await http.post('/crossborder/quotes', quoteBody, { headers: internal });
    // eslint-disable-next-line no-console
    console.log('   quote MC resp:', JSON.stringify(q.data).slice(0, 300));
    const qOk = q.status === 200 || q.status === 201;
    const hasProposal =
      JSON.stringify(q.data).includes('proposal') ||
      JSON.stringify(q.data).includes('charged_amount');
    check('POST /crossborder/quotes (sandbox, passthrough)', qOk, `HTTP ${q.status}`);
    check('quote: ответ содержит proposal/charged_amount', qOk && hasProposal);

    // 3) quote с суммой-ЧИСЛОМ → DTO @IsString ловит → 400 (а не отправка кривого тела в MC)
    const badAmount = JSON.parse(JSON.stringify(quoteBody));
    badAmount.quoterequest.payment_amount.amount = 105.15; // number!
    const qb = await http.post('/crossborder/quotes', badAmount, { headers: internal });
    check('POST /crossborder/quotes с amount=number → 400', qb.status === 400, `HTTP ${qb.status}`);

    // 4) admin: OWN без secretRef → 400 от @ValidateIf (раньше — ручная проверка)
    const tn = await http.post(
      '/admin/tenants',
      { name: 'e2e-own', credentialMode: 'OWN' },
      { headers: admin },
    );
    check('POST /admin/tenants OWN без secretRef → 400', tn.status === 400, `HTTP ${tn.status}`);

    // 5) oauth: неверный grant_type → 400 от DTO @IsIn
    const tok = await http.post('/oauth/token', { grant_type: 'password' });
    check('POST /oauth/token grant_type=password → 400', tok.status === 400, `HTTP ${tok.status}`);

    // 6) webhook без токена → 401 (fail-closed, не зависит от инфры)
    const wh = await http.post('/webhooks/mastercard', { eventRef: 'x' });
    check('POST /webhooks/mastercard без токена → 401', wh.status === 401, `HTTP ${wh.status}`);

    // 7) webhook с токеном → 200
    const wh2 = await http.post(
      '/webhooks/mastercard',
      { eventRef: `e2e-${Date.now()}`, eventType: 'STATUS_CHG' },
      { headers: { 'x-webhook-token': process.env.MC_WEBHOOK_TOKEN ?? '' } },
    );
    check('POST /webhooks/mastercard с токеном → 200', wh2.status === 200, `HTTP ${wh2.status}`);
  } finally {
    await app.close();
  }

  // eslint-disable-next-line no-console
  console.log(`\nИТОГО: ${pass} pass, ${fail} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error('E2E_CHECK_CRASH', (e as Error)?.message ?? e);
  process.exit(1);
});
