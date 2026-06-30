import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource ONLY for the TypeORM CLI (migration:generate / run / revert).
 * Runtime connects via `DatabaseModule` (forRootAsync, autoLoadEntities) — here the
 * schema is NOT synchronized, it is driven only by migrations.
 *
 * Entities via a static **glob path** (`*.entity.ts|js`), as in the NestJS docs
 * (techniques/sql): `autoLoadEntities` has no effect on a bare `DataSource`, and
 * `migration:generate` diffs entity metadata against the DB. Connection comes from
 * env (defaults match the demo's shared compose Postgres + `mc_demo` database).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DEMO_DB_HOST ?? 'localhost',
  port: Number(process.env.DEMO_DB_PORT) || 5432,
  username: process.env.DEMO_DB_USER ?? 'mc',
  password: process.env.DEMO_DB_PASSWORD ?? 'mc',
  database: process.env.DEMO_DB_NAME ?? 'mc_demo',
  // from __dirname → src/**/*.entity.ts (ts-node) and dist/**/*.entity.js (build)
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
