import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * PostgreSQL connection (TypeORM) — ONLY for the dev harness (standalone run,
 * e2e, `npm run ping`); this module is not part of the host monolith. The schema
 * is driven EXCLUSIVELY by migrations (`synchronize` is not used — NestJS/TypeORM
 * recommendation, see techniques/sql "synchronize shouldn't be used…"). Entities
 * are picked up automatically from the sub-modules' `forFeature`
 * (`autoLoadEntities`), without an explicit list.
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
        // Pool size is PER-POD. In a multi-pod deploy the total = pods × max, and
        // it's easy to hit Postgres max_connections (default 100). Keep it small
        // and configurable; for many pods, use PgBouncer.
        const poolMax = Number(config.get<string>('DB_POOL_MAX')) || 10;
        return {
          type: 'postgres',
          url,
          // Entities — automatically from each sub-module's forFeature (NestJS
          // "Auto-load entities"): an explicit list in the root module leaks
          // domain boundaries (techniques/sql). The host does the same when embedding.
          autoLoadEntities: true,
          extra: { max: poolMax },
          // Schema is migrations-ONLY. We don't set `synchronize` (TypeORM
          // default=false): auto-sync risks data loss and is used in neither dev nor prod.
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          // The dev harness runs migrations on startup (replacing the former
          // synchronize), so e2e/ping work out of the box. In prod the host / a
          // dedicated Job runs them (DB_MIGRATIONS_RUN=true), not each pod.
          migrationsRun:
            !isProd || config.get<string>('DB_MIGRATIONS_RUN') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
