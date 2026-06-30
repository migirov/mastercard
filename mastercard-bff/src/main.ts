import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { McConfig } from './config/mc-config';

/**
 * mastercard-bff is STATELESS — no database to create/migrate (unlike app-bff). It just
 * boots Nest, enables CORS for the browser, and proxies cross-border calls to the gateway.
 */
async function bootstrap() {
  // bodyParser:false → body parsing (incl. the route-scoped RFI 2 MB limit) is owned by
  // AppModule.configure as Nest middleware, so Nest's default parser doesn't pre-empt it.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // The frontend (browser) calls this BFF cross-origin during the demo — allow it.
  app.enableCors({ origin: true, credentials: false });
  app.enableShutdownHooks();
  // Typed config (not a stray process.env read) now that the DI container exists.
  const port = app.get(McConfig).port;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `mastercard-bff listening on http://0.0.0.0:${port}`,
  );
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start mastercard-bff: ${(err as Error).message}`,
  );
  process.exit(1);
});
