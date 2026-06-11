import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { KvEntity } from './entities/kv.entity';

/** Подключение к PostgreSQL (TypeORM). Схема — synchronize в dev, миграции в проде. */
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
          entities: [TenantEntity, OAuthClientEntity, AuditLogEntity, KvEntity],
          extra: { max: poolMax },
          // В production авто-синхронизацию схемы НЕ включаем НИКОГДА (риск
          // потери данных при auto-alter) — только миграции. В dev: по умолчанию
          // вкл, можно выключить DB_SYNC=false.
          synchronize: !isProd && config.get<string>('DB_SYNC') !== 'false',
          // Миграции (.ts через ts-node / .js в dist). Прогон — явно через
          // `npm run migration:run` (или DB_MIGRATIONS_RUN=true для авто на старте;
          // в multi-pod лучше отдельным Job/init-container, а не на каждом поде).
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
