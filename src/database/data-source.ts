import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { MASTERCARD_ENTITIES } from '../mastercard.entities';

/**
 * Standalone DataSource ТОЛЬКО для TypeORM CLI (migration:generate / run / revert).
 * Рантайм подключается через `DatabaseModule` (forRootAsync) — здесь схема не
 * синхронизируется. `DATABASE_URL` берётся из окружения (в проде задан; локально —
 * `DATABASE_URL=... npm run migration:run`).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [...MASTERCARD_ENTITIES],
  // от __dirname → работает и в ts-node (.ts), и в скомпилированном dist (.js)
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
