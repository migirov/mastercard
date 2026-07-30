import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { McConfig } from './config/mc-config';

/**
 * mastercard-bff is STATELESS — no database to create/migrate (unlike app-bff). It just
 * boots Nest, enables CORS for the browser, and proxies cross-border calls to the gateway.
 */
/**
 * Fail fast when the API token is missing, rather than letting the service come up and 401
 * every request with no explanation.
 *
 * Production throws (the process exits) because an unauthenticated deploy is worse than no
 * deploy — and this service's live-default capabilities sign real Mastercard sandbox calls
 * with the platform's OAuth1 key. Elsewhere it warns as loudly as a log line can: the guard
 * still denies everything, so this message is the only thing standing between a developer
 * and half an hour of debugging blanket 401s.
 */
function assertApiTokenConfigured(cfg: McConfig, log: Logger): void {
  if (cfg.demoApiToken) return;
  const msg =
    'DEMO_API_TOKEN is not set — every request except /health will be rejected with 401.';
  if (cfg.isProduction) throw new Error(msg);
  log.warn(msg);
  log.warn('Set DEMO_API_TOKEN (see .env.example) and restart.');
}

/**
 * Same treatment for the gate-proof key. Unset means `verifyGateProof` rejects every proof, so
 * every cross-border route 401s while app-bff (with its own copy set) keeps working — the drift
 * failure is partial and therefore confusing, which is exactly why it is worth a boot-time line.
 *
 * The value must be byte-identical to app-bff's `DEMO_GATE_SECRET`; this service never mints a
 * proof, it only verifies what app-bff signed.
 */
function assertGateSecretConfigured(cfg: McConfig, log: Logger): void {
  if (cfg.demoGateSecret) return;
  const msg =
    'DEMO_GATE_SECRET is not set — every request except /health will be rejected with 401.';
  if (cfg.isProduction) throw new Error(msg);
  log.warn(msg);
  log.warn(
    'Set DEMO_GATE_SECRET to the SAME value as app-bff (see .env.example) and restart.',
  );
}

async function bootstrap() {
  // bodyParser:false → body parsing (incl. the route-scoped RFI 2 MB limit) is owned by
  // AppModule.configure as Nest middleware, so Nest's default parser doesn't pre-empt it.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const log = new Logger('Bootstrap');
  // Typed config (not a stray process.env read) now that the DI container exists.
  const cfg = app.get(McConfig);
  assertApiTokenConfigured(cfg, log);
  assertGateSecretConfigured(cfg, log);
  // An explicit origin allowlist, not `origin: true` (which reflects whatever Origin the
  // caller sent — i.e. every site). `Authorization` and `X-XBS-Gate` MUST stay in allowedHeaders:
  // naming the list at all disables cors's default reflection, so omitting either makes the
  // browser reject every authenticated cross-origin call at preflight. Drop `X-XBS-Gate` and the
  // symptom is that `npm run dev` fails at preflight on EVERY call, with the gate itself looking
  // fine. Only affects split-origin dev; the compose stack serves the SPA same-origin via nginx.
  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-XBS-Gate'],
  });
  app.enableShutdownHooks();
  await app.listen(cfg.port);
  log.log(`mastercard-bff listening on http://0.0.0.0:${cfg.port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start mastercard-bff: ${(err as Error).message}`,
  );
  process.exit(1);
});
