import { AuditLogEntity } from './audit/entities/audit-log.entity';
import { OAuthClientEntity } from './auth/entities/oauth-client.entity';
import { PaymentIdempotencyEntity } from './crossborder/payments/entities/payment-idempotency.entity';
import { TenantEntity } from './tenants/entities/tenant.entity';
import { TransactionStatusEntity } from './webhooks/entities/transaction-status.entity';

/**
 * The single list of the module's TypeORM entities — ONE source of truth (previously
 * duplicated in mastercard.module.ts, database.module.ts, and data-source.ts). A
 * separate lightweight file (only entity imports, no @Module): pulled in by the umbrella
 * module, the dev DatabaseModule, and the CLI DataSource — without dragging the whole
 * module graph into the typeorm CLI.
 *
 * When embedding, the host MUST include them in its TypeORM DataSource
 * (`forRoot({ entities: [...MASTERCARD_ENTITIES] })` or `autoLoadEntities: true`),
 * otherwise repositories resolve but the first query fails with EntityMetadataNotFoundError.
 */
export const MASTERCARD_ENTITIES = [
  TenantEntity,
  OAuthClientEntity,
  AuditLogEntity,
  PaymentIdempotencyEntity,
  TransactionStatusEntity,
];
