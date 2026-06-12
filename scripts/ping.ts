/**
 * Проверка end-to-end через тенанта (Фаза 1):
 *   npm run ping            — tenant 'platform'
 *   npm run ping -- acme    — другой тенант
 *   npm run ping -- own-demo — должен быть отказ (gating)
 */
import { NestFactory } from '@nestjs/core';
import { HttpException, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CrossBorderService } from '../src/crossborder/crossborder.service';

async function main() {
  const log = new Logger('ping');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const cb = app.get(CrossBorderService);

  const tenantId = process.argv[2] ?? 'platform';
  log.log(`getBalances(tenant='${tenantId}')`);

  let exitCode = 0;
  try {
    const data = await cb.getBalances(tenantId);
    log.log('✅ 2xx — мульти-тенант поток работает, credentials рабочие');
    log.log('Тело: ' + JSON.stringify(data).slice(0, 600));
  } catch (e) {
    const status = e instanceof HttpException ? e.getStatus() : '—';
    log.error(`❌ отказ (HTTP ${status}): ${(e as Error).message}`);
    exitCode = 1;
  }

  await app.close();
  process.exit(exitCode);
}

main().catch((e) => {
  new Logger('ping').error(e.message);
  process.exit(1);
});
