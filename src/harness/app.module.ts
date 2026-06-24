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
import { validateEnv } from '../config/env.validation';
import { MastercardModuleOptions } from '../config/gateway-config';
import { DatabaseModule } from '../database/database.module';
import { DevSeedService } from './dev-seed.service';
import { HealthController } from '../health/controllers/health.controller';
import { MastercardModule } from '../mastercard.module';
import { TenantEntity } from '../tenants/entities/tenant.entity';

/**
 * Dev harness (standalone run, e2e, Swagger). In a production monolith the host
 * imports ONLY `MastercardModule.forRootAsync(...)` and provides the infrastructure
 * (ConfigModule, DB connection, logger, health probes) itself. Here we stand up that
 * infrastructure locally to run the service autonomously. `HealthController`
 * (`/health`, `/ready`) is a global app-level root route, so it lives here, not in the
 * embeddable `MastercardModule` (otherwise it would collide with the host's probes).
 */
@Module({
  imports: [
    // reads .env from the project root + validates env vars at startup (fail-fast)
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TerminusModule, // health indicators for HealthController (harness)
    // Structured JSON logs + correlation-id (x-request-id) across all logs.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // don't log health probes (noise)
        autoLogging: {
          ignore: (req) => {
            const u = (req.url ?? '') as string;
            return u.startsWith('/health') || u.startsWith('/ready');
          },
        },
        // correlation-id: accept the incoming X-Request-Id ONLY if it's of a safe
        // format (anti log-injection / bloat), otherwise generate one.
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
        // Slim logs: only what's needed (id/method/url + status/time). Don't dump
        // headers wholesale — smaller log volume and no risk of leaking secret
        // headers (Authorization/X-*-Token).
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
        // a safety net in case headers are logged somewhere else
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
    // Dev DB: TypeORM connection (in a monolith the host provides it).
    DatabaseModule,
    // TenantEntity repository for DevSeedService (seeds the baseline platform on startup —
    // dev harness only; the embeddable module does no seeding on boot).
    TypeOrmModule.forFeature([TenantEntity]),
    // The entire Mastercard integration in a single module. Config comes from .env via
    // ConfigService (in a monolith the host passes its own useFactory).
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
          (c.get<string>('MC_SECRET_STORE') as
            | 'local'
            | 'aws-secrets-manager') ?? 'local',
        secretStoreRegion: c.get<string>('MC_SECRET_STORE_REGION'),
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
