import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { MastercardModuleOptions } from './config/gateway-config';
import { DatabaseModule } from './database/database.module';
import { DevSeedService } from './dev-seed.service';
import { HealthController } from './health/health.controller';
import { MastercardModule } from './mastercard.module';
import { TenantEntity } from './tenants/tenant.entity';

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
    // Репозиторий TenantEntity для DevSeedService (засев базового platform на старте
    // — только dev-харнесс; во встраиваемом модуле засева на boot нет).
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
export class AppModule {}
