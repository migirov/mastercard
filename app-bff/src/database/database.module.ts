import { join } from 'path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/app-config';

/**
 * PostgreSQL connection (TypeORM) for the demo BFF. The schema is driven
 * EXCLUSIVELY by migrations (`synchronize: false` — NestJS/TypeORM recommendation,
 * techniques/sql "synchronize shouldn't be used in production"); we apply it to the
 * demo too so it mirrors the gateway exactly. Entities are picked up automatically
 * from the sub-modules' `forFeature` (`autoLoadEntities`), without an explicit list.
 *
 * The connection targets the demo's OWN database (`mc_demo`) on the shared compose
 * Postgres — `main.ts` creates it before Nest boots (Postgres has no CREATE DATABASE
 * IF NOT EXISTS).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => {
        const { host, port, user, password, database } = cfg.db;
        return {
          type: 'postgres',
          host,
          port,
          username: user,
          password,
          database,
          // Entities — automatically from each sub-module's forFeature
          // (techniques/sql "Auto-load entities"): no explicit root list.
          autoLoadEntities: true,
          // Schema is migrations-ONLY. `synchronize` defaults to false; we never
          // auto-sync (data-loss risk), same as the gateway.
          synchronize: false,
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          // Non-prod runs migrations on boot so the demo works out of the box; in
          // prod a dedicated step would run them (this demo is non-prod by design).
          migrationsRun: !cfg.isProduction,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
