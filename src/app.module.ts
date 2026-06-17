import { randomUUID } from 'crypto';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { MastercardModuleOptions } from './config/gateway-config';
import { DatabaseModule } from './database/database.module';
import { DevSeedService } from './dev-seed.service';
import { HealthController } from './health/controllers/health.controller';
import { MastercardModule } from './mastercard.module';
import { TenantEntity } from './tenants/entities/tenant.entity';

/**
 * Dev-харнесс (standalone-запуск, e2e, Swagger). В production-монолите хост
 * импортирует ТОЛЬКО `MastercardModule.forRootAsync(...)`, а инфраструктуру
 * (ConfigModule, БД-соединение, логгер, health-пробы) предоставляет
 * сам. Здесь мы поднимаем эту инфраструктуру локально, чтобы прогонять сервис
 * автономно. `HealthController` (`/health`, `/ready`) — глобальный корневой маршрут
 * уровня приложения, поэтому живёт здесь, а не во встраиваемом `MastercardModule`
 * (иначе коллизия с пробами хоста).
 */
@Module({
  imports: [
    // читает .env из корня проекта + валидирует переменные на старте (fail-fast)
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TerminusModule, // health-индикаторы для HealthController (харнесс)
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
            typeof candidate === 'string' &&
            /^[A-Za-z0-9._-]{1,128}$/.test(candidate)
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
    // Dev-БД: TypeORM-соединение (в монолите его даёт хост).
    DatabaseModule,
    // TenantEntity repository for DevSeedService (seeds the baseline platform on startup —
    // dev harness only; the embeddable module does no seeding on boot).
    TypeOrmModule.forFeature([TenantEntity]),
    // Вся интеграция Mastercard — одним модулем. Конфиг берём из .env через
    // ConfigService (в монолите хост передаёт свой useFactory).
    MastercardModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService): MastercardModuleOptions => ({
        baseUrl: c.getOrThrow<string>('MC_BASE_URL'),
        consumerKey: c.getOrThrow<string>('MC_CONSUMER_KEY'),
        partnerId: c.getOrThrow<string>('MC_PARTNER_ID'),
        signingKeyPath: c.get<string>('MC_SIGNING_KEY_PATH'),
        signingKeyPassword: c.get<string>('MC_SIGNING_KEY_PASSWORD'),
        encryptionEnabled: c.get<string>('MC_ENCRYPTION_ENABLED') === 'true',
        encryptionCertPath: c.get<string>('MC_ENCRYPTION_CERT_PATH'),
        encryptionFingerprint: c.get<string>('MC_ENCRYPTION_FINGERPRINT'),
        decryptionKeyPath: c.get<string>('MC_DECRYPTION_KEY_PATH'),
        secretStore:
          (c.get<string>('MC_SECRET_STORE') as 'local' | 'vault') ?? 'local',
        credsCacheTtlMs:
          Number(c.get<string>('MC_CREDS_CACHE_TTL_MS')) || undefined,
        jwtSecret: c.getOrThrow<string>('MC_JWT_SECRET'),
        internalToken: c.getOrThrow<string>('MC_INTERNAL_TOKEN'),
        adminToken: c.getOrThrow<string>('MC_ADMIN_TOKEN'),
        webhookToken: c.get<string>('MC_WEBHOOK_TOKEN'),
        nodeEnv: c.get<string>('NODE_ENV'),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [DevSeedService],
})
export class AppModule implements NestModule {
  /**
   * Body-size limits as Nest middleware (the dev harness owns the GLOBAL limit; in a
   * monolith the host does). Registered here via `configure`, NOT `app.useBodyParser`
   * in main.ts, so the order is explicit and controllable:
   *   1. RFI upload (`POST /crossborder/rfi/documents`) — 2mb (a base64 file up to
   *      ~1.37MB). Applied FIRST so Express's first-parser-wins lets it claim the body
   *      (`req._body`), and the global parser below then skips this route.
   *   2. everything else — strict 256kb (json + urlencoded for the OAuth2 token form).
   * Cross-module middleware order is root-first, so this MUST live in the root module
   * (a sub-module's `configure` would run after the global parser and be pre-empted).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(json({ limit: '2mb' })).forRoutes({
      path: 'crossborder/rfi/documents',
      method: RequestMethod.POST,
    });
    consumer
      .apply(
        json({ limit: '256kb' }),
        urlencoded({ extended: false, limit: '256kb' }),
      )
      .forRoutes('*');
  }
}
