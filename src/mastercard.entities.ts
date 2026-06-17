import { AuditLogEntity } from './audit/entities/audit-log.entity';
import { OAuthClientEntity } from './auth/entities/oauth-client.entity';
import { PaymentIdempotencyEntity } from './crossborder/entities/payment-idempotency.entity';
import { TenantEntity } from './tenants/entities/tenant.entity';
import { TransactionStatusEntity } from './webhooks/entities/transaction-status.entity';

/**
 * Единый список TypeORM-сущностей модуля — ОДИН источник истины (раньше дублировался
 * в mastercard.module.ts, database.module.ts и data-source.ts). Отдельный лёгкий
 * файл (только импорты сущностей, без @Module): его тянут и зонтичный модуль, и
 * dev-DatabaseModule, и CLI-DataSource — без затягивания всего графа модулей в
 * typeorm CLI.
 *
 * Хост при встраивании ДОЛЖЕН включить их в свой TypeORM DataSource
 * (`forRoot({ entities: [...MASTERCARD_ENTITIES] })` или `autoLoadEntities: true`),
 * иначе репозитории резолвятся, но первый запрос падает EntityMetadataNotFoundError.
 */
export const MASTERCARD_ENTITIES = [
  TenantEntity,
  OAuthClientEntity,
  AuditLogEntity,
  PaymentIdempotencyEntity,
  TransactionStatusEntity,
];
