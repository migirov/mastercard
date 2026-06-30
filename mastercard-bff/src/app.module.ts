import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { validateEnv } from './config/env.validation';
import { McConfigModule } from './config/config.module';
import { XbsModule } from './xbs/xbs.module';
import { FeaturesModule } from './features/features.module';
import { HealthController } from './health/controllers/health.controller';

/**
 * mastercard-bff root module — the Mastercard CROSS-BORDER layer. Proxies the cross-border
 * operations to the real `mastercard` gateway (live mode) or synthesizes them (demo mode,
 * per-capability). STATELESS: no database, no entity store — that's the sibling `app-bff`.
 * In production this layer is replaced by the host calling the gateway directly.
 *
 * Conventions mirror the gateway: env validated with Zod at startup
 * (`ConfigModule.validate`) + a typed `McConfig` (no scattered `process.env`).
 */
@Module({
  imports: [
    // reads .env from the project root + validates env vars at startup (fail-fast)
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // typed McConfig (global)
    McConfigModule,
    XbsModule,
    FeaturesModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  /**
   * Body parsing is owned here as Nest middleware (mirrors the gateway's team-lead convention,
   * issue #11) rather than `app.useBodyParser`/raw `app.use` in main.ts. The RFI document upload
   * carries a base64 file above the strict global limit, so its larger parser is registered
   * FIRST — Express uses the first parser that sets `req._body`, so the route-scoped 2 MB limit
   * wins for that route while every other route keeps the strict 256 kb limit. `main.ts` creates
   * the app with `bodyParser: false` so Nest's default parser doesn't pre-empt these.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(json({ limit: '2mb' })).forRoutes({
      path: 'features/rfi/documents',
      method: RequestMethod.POST,
    });
    consumer
      .apply(
        json({ limit: '256kb' }),
        urlencoded({ extended: true, limit: '256kb' }),
      )
      .forRoutes('*');
  }
}
