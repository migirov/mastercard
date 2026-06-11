import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { KvEntity } from './entities/kv.entity';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { TenantEntity } from './entities/tenant.entity';

/**
 * Standalone DataSource ТОЛЬКО для TypeORM CLI (migration:generate / run / revert).
 * Рантайм подключается через `DatabaseModule` (forRootAsync) — здесь схема не
 * синхронизируется. `DATABASE_URL` берётся из окружения (в проде задан; локально —
 * `DATABASE_URL=... npm run migration:run`).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [TenantEntity, OAuthClientEntity, AuditLogEntity, KvEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
