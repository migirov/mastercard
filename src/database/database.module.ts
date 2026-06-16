import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Подключение к PostgreSQL (TypeORM) — ТОЛЬКО для dev-харнесса (standalone-запуск,
 * e2e, `npm run ping`); в монолит хоста этот модуль не идёт. Схему ведут
 * ИСКЛЮЧИТЕЛЬНО миграции (`synchronize` не используем — рекомендация NestJS/TypeORM,
 * см. techniques/sql «synchronize shouldn't be used…»). Сущности подхватываются
 * автоматически из `forFeature` суб-модулей (`autoLoadEntities`), без явного списка.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) {
          throw new Error('DATABASE_URL is not set in .env');
        }
        const isProd =
          (config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
          'production';
        // Размер пула — ПЕР-ПОД. При многоподовом деплое суммарно = подов × max,
        // и легко упереться в Postgres max_connections (дефолт 100). Держим
        // небольшим и конфигурируемым; при большом числе подов — PgBouncer.
        const poolMax = Number(config.get<string>('DB_POOL_MAX')) || 10;
        return {
          type: 'postgres',
          url,
          // Сущности — автоматически из forFeature каждого суб-модуля (NestJS
          // «Auto-load entities»): явный список в корневом модуле течёт границами
          // домена (techniques/sql). Хост при встраивании делает то же.
          autoLoadEntities: true,
          extra: { max: poolMax },
          // Схема — ТОЛЬКО миграции. `synchronize` не задаём (TypeORM default=false):
          // авто-синхронизация рискует потерей данных и не используется ни в dev, ни в prod.
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          // dev-харнесс прогоняет миграции на старте (замена прежнего synchronize),
          // чтобы e2e/ping работали из коробки. В prod — гонит хост/отдельный Job
          // (DB_MIGRATIONS_RUN=true), а не каждый под.
          migrationsRun:
            !isProd || config.get<string>('DB_MIGRATIONS_RUN') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
