import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RecordsModule } from './records/records.module';
import { SeedModule } from './seed/seed.module';
import { HealthController } from './health/controllers/health.controller';

/**
 * app-bff root module — the PERMANENT frontend backend. Emulates the small SDK surface
 * the UI uses (generic entity CRUD + auth.me + a couple of integrations) over Postgres.
 * It has NOTHING to do with Mastercard — the cross-border proxy lives in `mastercard-bff`.
 *
 * Conventions mirror the sibling gateway: env validated with Zod at startup
 * (`ConfigModule.validate`), a typed `AppConfig` (no scattered `process.env`), and a
 * migrations-only TypeORM schema (`synchronize: false`).
 */
@Module({
  imports: [
    // reads .env from the project root + validates env vars at startup (fail-fast)
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // typed AppConfig (global) — must precede DatabaseModule, which injects it
    AppConfigModule,
    DatabaseModule,
    RecordsModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
