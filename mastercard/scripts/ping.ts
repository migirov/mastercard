/**
 * End-to-end check via a tenant (Phase 1):
 *   npm run ping            — tenant 'platform'
 *   npm run ping -- acme    — a different tenant
 *   npm run ping -- own-demo — should be rejected (gating)
 */
import { NestFactory } from '@nestjs/core';
import { HttpException, Logger } from '@nestjs/common';
import { AppModule } from '../src/harness/app.module';
import { AccountsService } from '../src/crossborder/accounts/services/accounts.service';

async function main() {
  const log = new Logger('ping');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // strict:false — getBalances lives in AccountsService, a provider deep in the
  // CrossBorder area module (not the root), so resolve it across the whole graph.
  const cb = app.get(AccountsService, { strict: false });

  const tenantId = process.argv[2] ?? 'platform';
  log.log(`getBalances(tenant='${tenantId}')`);

  let exitCode = 0;
  try {
    const data = await cb.getBalances(tenantId);
    log.log('✅ 2xx — the multi-tenant flow works, credentials are valid');
    log.log('Body: ' + JSON.stringify(data).slice(0, 600));
  } catch (e) {
    const status = e instanceof HttpException ? e.getStatus() : '—';
    log.error(`❌ rejected (HTTP ${status}): ${(e as Error).message}`);
    exitCode = 1;
  }

  await app.close();
  process.exit(exitCode);
}

main().catch((e) => {
  new Logger('ping').error(e.message);
  process.exit(1);
});
