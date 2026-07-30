import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { AppConfigModule } from './config/config.module';
import { DemoAuthGuard } from './common/guards/demo-auth.guard';
import { BoundedThrottlerStorage } from './common/throttler/bounded-throttler.storage';
import { DatabaseModule } from './database/database.module';
import { RecordsModule } from './records/records.module';
import { SeedModule } from './seed/seed.module';
import { GateModule } from './gate/gate.module';
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
    // Rate-limit buckets for the access gate. Registered here (the module is @Global in v5) but
    // NOT wired as an APP_GUARD: a global ThrottlerGuard would also cap the generic /entities
    // CRUD, which the scripted demo walkthrough drives hard enough to trip it. Scope stays on
    // GateController. Named 'gate' rather than 'default' so `@Throttle({ gate: … })` reads as
    // documentation and a future second tracker cannot silently inherit these limits.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'gate', ttl: 900_000, limit: 10 }],
      storage: new BoundedThrottlerStorage(),
    }),
    DatabaseModule,
    RecordsModule,
    SeedModule,
    GateModule,
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
