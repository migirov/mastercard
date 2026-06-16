import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource ТОЛЬКО для TypeORM CLI (migration:generate / run / revert).
 * Рантайм подключается через `DatabaseModule` (forRootAsync, autoLoadEntities) —
 * здесь схема НЕ синхронизируется, ведётся только миграциями.
 *
 * Сущности — статическим **glob-путём** (`*.entity.ts|js`), как в доке NestJS
 * (techniques/sql: «…unless you use a static glob path»): `autoLoadEntities` на сырой
 * `DataSource` не действует, а `migration:generate` диффает метаданные сущностей
 * против БД — поэтому источник сущностей тут нужен (glob, без ручного списка).
 * `DATABASE_URL` — из окружения (в проде задан; локально `DATABASE_URL=... npm run migration:run`).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // от __dirname → src/**/*.entity.ts (ts-node) и dist/**/*.entity.js (build)
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
