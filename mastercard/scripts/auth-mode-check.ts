/**
 * End-to-end check of the ACTIVE outbound auth mode: boots the real module graph
 * and sends one quote to Mastercard through the full stack (config → auth strategy
 * → encrypt/sign interceptor → transport). A quote moves no money.
 *
 *   npm run auth-mode-check
 *     → whatever .env says (today: .com + OAuth 1.0a)
 *
 *   MC_AUTH_MODE=oauth2-request-token \
 *   MC_BASE_URL=https://sandbox.api.xbs.mastercard.eu npm run auth-mode-check
 *     → the PSD2 EU edge with an OAUTH2_REQUEST_TOKEN
 *
 * Both are expected to print a proposal id. Requires Postgres (the module is
 * DB-backed): `docker compose up -d postgres`.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/harness/app.module';
import { QuotesService } from '../src/crossborder/quotes/services/quotes.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  console.log(
    `mode: ${process.env.MC_AUTH_MODE ?? 'oauth1 (default)'}  host: ${process.env.MC_BASE_URL}`,
  );
  const quotes = app.get(QuotesService, { strict: false });
  const ref = '08' + Date.now() + 'ACFQ';
  const body = {
    quoterequest: {
      transaction_reference: ref,
      sender_account_uri: 'tel:+25406005',
      recipient_account_uri: 'tel:+254069832',
      payment_amount: { amount: '105.15', currency: 'USD' },
      payment_origination_country: 'USA',
      payment_type: 'P2P',
      quote_type: { forward: { receiver_currency: 'GBP', fees_included: true } },
    },
  };
  try {
    const r = (await quotes.createQuote('platform', body as never)) as {
      quote?: {
        transaction_reference?: string;
        proposals?: { proposal?: { id?: string; charged_amount?: { amount?: string; currency?: string } }[] };
      };
    };
    const first = r?.quote?.proposals?.proposal?.[0];
    console.log('RESULT   : OK through the full gateway stack');
    console.log('ref      :', r?.quote?.transaction_reference);
    console.log('proposal :', first?.id);
    console.log(
      'charged  :',
      first?.charged_amount?.amount,
      first?.charged_amount?.currency,
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    console.log('RESULT   : FAILED', err?.status ?? '', err?.message ?? e);
  }
  await app.close();
  process.exit(0);
}

void main();
