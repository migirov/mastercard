import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { AppConfigModule } from './config/config.module';
import { DemoAuthGuard } from './common/guards/demo-auth.guard';
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
  providers: [
    // Deny-by-default: every route needs the shared bearer token except DemoAuthGuard's
    // small PUBLIC_PATHS set. Global rather than per-controller so a new controller cannot
    // ship unguarded by omission — the failure mode that left this service open.
    { provide: APP_GUARD, useClass: DemoAuthGuard },
  ],
})
export class AppModule {}
