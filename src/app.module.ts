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
        // correlation-id: входящий X-Request-Id принимаем ТОЛЬКО если он
        // безопасного формата (анти log-injection / раздувание), иначе генерим.
        genReqId: (req, res) => {
          const raw = req.headers['x-request-id'];
          const candidate = Array.isArray(raw) ? raw[0] : raw;
          const id =
            typeof candidate === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(candidate)
              ? candidate
              : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Slim-логи: только то, что нужно (id/method/url + статус/время). НЕ
        // дампим заголовки целиком — меньше объём логов и нет риска утечки
        // секретных заголовков (Authorization/X-*-Token).
        serializers: {
          req: (req: { id: unknown; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        // подстраховка на случай логирования заголовков где-то ещё
        redact: {
          paths: [
            'req.headers.authorization',
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
