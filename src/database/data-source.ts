import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource ONLY for the TypeORM CLI (migration:generate / run / revert).
 * Runtime connects via `DatabaseModule` (forRootAsync, autoLoadEntities) — here the
 * schema is NOT synchronized, it is driven only by migrations.
 *
 * Entities via a static **glob path** (`*.entity.ts|js`), as in the NestJS docs
 * (techniques/sql: "…unless you use a static glob path"): `autoLoadEntities` has no
 * effect on a bare `DataSource`, and `migration:generate` diffs entity metadata
 * against the DB — so an entity source is needed here (glob, no manual list).
 * `DATABASE_URL` comes from the environment (set in prod; locally
 * `DATABASE_URL=... npm run migration:run`).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // from __dirname → src/**/*.entity.ts (ts-node) and dist/**/*.entity.js (build)
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
