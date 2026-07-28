import 'reflect-metadata';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig, DB_DEFAULTS } from './config/app-config';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * DB connection parameters, read straight from env BEFORE Nest boots.
 *
 * NOTE: this is the ONE place that reads `process.env` directly instead of the typed
 * `AppConfig` — it runs before the Nest DI container (and thus `AppConfig`) exists,
 * to create the database. Defaults come from the shared `DB_DEFAULTS` (one source of truth).
 */
function dbEnv() {
  return {
    host: process.env.DEMO_DB_HOST ?? DB_DEFAULTS.host,
    port: Number(process.env.DEMO_DB_PORT) || DB_DEFAULTS.port,
    user: process.env.DEMO_DB_USER ?? DB_DEFAULTS.user,
    password: process.env.DEMO_DB_PASSWORD ?? DB_DEFAULTS.password,
    database: process.env.DEMO_DB_NAME ?? DB_DEFAULTS.database,
  };
}

/**
 * Create the app database if it does not exist yet. app-bff uses its OWN database `mc_demo`
 * on the shared compose Postgres (so it never touches the gateway's `mc_gateway` tables).
 * Postgres has no "CREATE DATABASE IF NOT EXISTS", so we connect to the default `postgres`
 * db and create it conditionally.
 */
/** Connect to the `postgres` admin DB, retrying while Postgres is still starting up. */
async function connectAdmin(
  host: string,
  port: number,
  user: string,
  password: string,
  log: Logger,
): Promise<Client> {
  for (let attempt = 1; ; attempt++) {
    const admin = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
    });
    try {
      await admin.connect();
      return admin;
    } catch (err) {
      await admin.end().catch(() => undefined);
      if (attempt >= 30) throw err;
      log.warn(
        `Postgres not ready (attempt ${attempt}/30): ${(err as Error).message} — retrying in 2s…`,
      );
      await delay(2000);
    }
  }
}

async function ensureDatabase(): Promise<void> {
  const { host, port, user, password, database } = dbEnv();
  const log = new Logger('Bootstrap');
  const admin = await connectAdmin(host, port, user, password, log);
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (exists.rowCount === 0) {
      // DB identifiers can't be parameterized — the name is from our own config, not user input.
      try {
        await admin.query(`CREATE DATABASE "${database}"`);
        log.log(`Created database "${database}"`);
      } catch (err) {
        // 42P04 = duplicate_database: a concurrent instance created it first — fine.
        if ((err as { code?: string }).code !== '42P04') throw err;
      }
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
}

/**
 * Last-resort guard against a request killing the process.
 *
 * Concretely: the installed `multer` (a transitive dep of @nestjs/platform-express) emits a
 * SECOND `error` event on its Multipart stream after its listeners have been removed, when a
 * multipart body ends without its closing boundary. The first error is handled normally and
 * the client gets a 400; the second has no listener and Node treats it as fatal. Reproduced
 * against the installed version: without this handler one unauthenticated request terminates
 * the process. It cannot be caught at the route — the event fires on the stream, outside any
 * promise chain — so the only version-free place to stop it is here.
 *
 * The trade-off is deliberate and worth stating: surviving an uncaught exception can leave a
 * process in an undefined state, which is why the usual advice is to log and exit. Here
 * exiting IS the denial of service, so we stay up and log at error level with the full stack
 * so the condition is visible in monitoring rather than silenced.
 */
function installCrashGuard(): void {
  const logger = new Logger('CrashGuard');
  process.on('uncaughtException', (err) => {
    logger.error(
      `uncaught exception (process kept alive deliberately): ${err?.message}`,
      err?.stack,
    );
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(`unhandled promise rejection: ${String(reason)}`);
  });
}

/**
 * Fail fast when the API token is missing, rather than letting the service come up and 401
 * every request with no explanation.
 *
 * Production throws (the process exits) because an unauthenticated deploy is worse than no
 * deploy. Elsewhere it warns as loudly as a log line can: the guard still denies everything,
 * so this message is the only thing standing between a developer and half an hour of
 * debugging blanket 401s.
 */
function assertApiTokenConfigured(cfg: AppConfig, log: Logger): void {
  if (cfg.demoApiToken) return;
  const msg =
    'DEMO_API_TOKEN is not set — every request except /health will be rejected with 401.';
  if (cfg.isProduction) throw new Error(msg);
  log.warn(msg);
  log.warn('Set DEMO_API_TOKEN (see .env.example) and restart.');
}

async function bootstrap() {
  installCrashGuard();
  await ensureDatabase();
  // Own the body parsers explicitly (bodyParser:false disables Nest's defaults). Nest would
  // otherwise register urlencoded({extended:true}), which on the installed body-parser 1.20.2
  // means qs depth:Infinity (CVE-2024-45590): one unauthenticated ~100 kb nested body burns
  // ~0.5 s of event loop BEFORE DemoAuthGuard runs. Nothing here consumes form bodies, so the
  // simple parser is free; json keeps the express 100 kb default.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: false });
  const log = new Logger('Bootstrap');
  // Typed config (not a stray process.env read) now that the DI container exists.
  const cfg = app.get(AppConfig);
  assertApiTokenConfigured(cfg, log);
  // An explicit origin allowlist, not `origin: true` (which reflects whatever Origin the
  // caller sent — i.e. every site). `Authorization` MUST stay in allowedHeaders: naming the
  // list at all disables cors's default reflection, so omitting it makes the browser reject
  // every authenticated cross-origin call at preflight. Only affects split-origin dev; the
  // compose stack serves the SPA same-origin through nginx.
  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.enableShutdownHooks();
  await app.listen(cfg.port);
  log.log(`app-bff listening on http://0.0.0.0:${cfg.port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start app-bff: ${(err as Error).message}`,
  );
  process.exit(1);
});
