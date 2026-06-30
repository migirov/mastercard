import 'reflect-metadata';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
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

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);
  // The frontend (browser) calls this BFF cross-origin during the demo — allow it.
  app.enableCors({ origin: true, credentials: false });
  app.enableShutdownHooks();
  // Typed config (not a stray process.env read) now that the DI container exists.
  const port = app.get(AppConfig).port;
  await app.listen(port);
  new Logger('Bootstrap').log(`app-bff listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start app-bff: ${(err as Error).message}`,
  );
  process.exit(1);
});
