/**
 * Smoke check of the DI graph: brings up the Nest application (without listen), runs
 * initialization (the TypeORM connection, GatewayConfig, preloading the platform
 * credentials) and closes immediately. Exit 0 + BOOT_CHECK_OK — the graph is valid.
 * Run: npx ts-node scripts/boot-check.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/harness/app.module';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  await app.init();
  await app.close();
  // eslint-disable-next-line no-console
  console.log('BOOT_CHECK_OK');
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error('BOOT_CHECK_FAIL', (e as Error)?.message ?? e);
  process.exit(1);
});
