import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { StoreModule } from './store/store.module';
import { TenantModule } from './tenants/tenant.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MastercardModule } from './mastercard/mastercard.module';
import { CrossBorderModule } from './crossborder/crossborder.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    // читает .env из корня проекта + валидирует переменные на старте (fail-fast)
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(), // cron-задачи (очистка kv_store)
    DatabaseModule,
    HealthModule,
    StoreModule,
    // Rate-limit: нативный @nestjs/throttler, штатный in-memory storage (per-pod).
    // Авторитетный глобальный лимит — на ингрессе/API-gateway.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuditModule,
    IdempotencyModule,
    TenantModule,
    CredentialsModule,
    MastercardModule,
    AuthModule,
    AdminModule,
    CrossBorderModule,
    WebhooksModule,
  ],
})
export class AppModule {}
