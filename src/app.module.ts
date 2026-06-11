import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
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
    // Структурные JSON-логи + correlation-id (x-request-id) сквозь все логи.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // health-пробы не логируем (шум)
        autoLogging: {
          ignore: (req) => {
            const u = (req.url ?? '') as string;
            return u.startsWith('/health') || u.startsWith('/ready');
          },
        },
        // correlation-id: берём входящий X-Request-Id или генерим; отдаём в ответе
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id =
            (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // НЕ логируем секреты из заголовков
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-token"]',
            'req.headers["x-admin-token"]',
            'req.headers["x-webhook-token"]',
          ],
          remove: true,
        },
      },
    }),
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
