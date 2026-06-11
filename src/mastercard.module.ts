import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { GatewayConfig, MastercardModuleOptions } from './config/gateway-config';
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './mastercard.module-definition';
import { StoreModule } from './store/store.module';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenants/tenant.module';
import { SecretsModule } from './secrets/secrets.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MastercardClientModule } from './mastercard/mastercard.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CrossBorderModule } from './crossborder/crossborder.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthController } from './health/health.controller';

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
 * Конфиг приходит через `forRootAsync` и раздаётся под-сервисам через глобальный
 * `GatewayConfig` (сервисы не читают `process.env`).
 *
 * Требования к хосту при встраивании: TypeORM-соединение, включающее наши entity
 * (`autoLoadEntities: true` или явный список), и `ScheduleModule.forRoot()` (для
 * cron-очистки `kv_store`; необязательно — у kv есть ленивое TTL-удаление).
 */
@Module({
  imports: [
    TerminusModule,
    // Per-pod rate-limit как самостоятельная защита (не делегируем ингрессу).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    StoreModule,
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
  controllers: [HealthController],
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
