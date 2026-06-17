import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  GatewayConfig,
  MastercardModuleOptions,
} from './config/gateway-config';
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './mastercard.module-definition';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenants/tenant.module';
import { SecretsModule } from './secrets/secrets.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MastercardClientModule } from './mastercard/mastercard-client.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CrossBorderModule } from './crossborder/crossborder.module';
import { WebhooksModule } from './webhooks/webhooks.module';

// Список сущностей — единый источник в mastercard.entities.ts. Ре-экспортируем,
// чтобы публичный API модуля (host: `import { MASTERCARD_ENTITIES }`) не менялся.
export { MASTERCARD_ENTITIES } from './mastercard.entities';

/**
 * Зонтичный модуль интеграции Mastercard Cross-Border — ЕДИНСТВЕННЫЙ модуль,
 * который импортирует хост-приложение (монолит `b24club-api` или dev-харнесс):
 *
 *   imports: [ MastercardModule.forRootAsync({ inject: [...], useFactory: ... }) ]
 *
 * Внутри собирает все под-модули (приватные детали реализации). Сознательно НЕ
 * поднимает БД (TypeORM-соединение предоставляет хост через свой `forRoot`) и НЕ
 * навешивает глобальные `ValidationPipe`/`Logger`/helmet/body-limit — этим владеет
 * хост-приложение. Per-pod rate-limit (`ThrottlerModule`) держим ВНУТРИ модуля,
 * чтобы защита не зависела от инфраструктуры (ингресс/прокси).
 *
 * Health-пробы (`/health`, `/ready`) НЕ входят в зонтичный модуль: это глобальный
 * корневой маршрут уровня всего приложения, и в монолите `b24club-api` уже есть
 * свои пробы — встроенный корневой контроллер коллизировал бы с ними. `HealthController`
 * живёт в dev-харнессе (`AppModule`); в монолите за liveness/readiness отвечает хост
 * (наши entity уже в его DataSource — readiness покроет и нашу БД).
 *
 * Конфиг приходит через `forRootAsync` и раздаётся под-сервисам через глобальный
 * `GatewayConfig` (сервисы не читают `process.env`).
 *
 * Host integration is an EXPLICIT contract — the module does NOT introspect the host
 * at runtime to warn about misconfiguration. What's required is stated where it's
 * enforced or consumed:
 *   - required config → typed `MastercardModuleOptions`, fail-fast in `GatewayConfig`
 *     (throws at startup on a missing required option / weak prod secret);
 *   - the TypeORM connection must include `MASTERCARD_ENTITIES` (the host spreads the
 *     exported list, or `autoLoadEntities: true`) — a missing entity throws
 *     `EntityMetadataNotFoundError` on first use, not silently;
 *   - host-provided wiring that can't be expressed in code (shutdown hooks, the RFI
 *     route body-parser, `webhookToken` for inbound webhooks) → the README
 *     "Host integration checklist".
 * Payment idempotency and webhook dedup live on Postgres (`payment_idempotency` /
 * `tx_status`); there is no separate KV layer (or its cron cleanup) anymore.
 */
@Module({
  imports: [
    // Per-pod rate-limit как самостоятельная защита (не делегируем ингрессу).
    // Именованный сет 'default' (120/мин) — на него по имени ссылается per-route
    // override `@Throttle({ default: { limit: 10, ... } })` на /oauth/token.
    // Несколько одновременных окон (short+long) не нужны → один сет.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuditModule,
    TenantModule,
    SecretsModule,
    CredentialsModule,
    MastercardClientModule,
    AuthModule,
    AdminModule,
    CrossBorderModule,
    WebhooksModule,
  ],
  providers: [
    {
      provide: GatewayConfig,
      useFactory: (opts: MastercardModuleOptions) => new GatewayConfig(opts),
      inject: [MODULE_OPTIONS_TOKEN],
    },
  ],
  exports: [GatewayConfig],
})
export class MastercardModule extends ConfigurableModuleClass {}
