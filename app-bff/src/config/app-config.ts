import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppDbConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

/**
 * DB connection defaults — ONE source of truth, shared with the pre-DI bootstrap in `main.ts`
 * (which must read `process.env` before the DI container exists to create the database).
 */
export const DB_DEFAULTS = {
  host: 'postgres',
  port: 5432,
  user: 'mc',
  password: 'mc',
  database: 'mc_demo',
} as const;

/**
 * Typed access to the app-bff configuration: a single `@Injectable` wrapper over
 * `ConfigService` (Zod-validated env) with getters — so NO service reads `process.env`
 * directly. The app-bff owns the demo app data (`mc_demo`) and the schema-less entity
 * store; it NEVER talks to Mastercard (that is the sibling `mastercard-bff`). Defaults here.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  /** HTTP port (browser-facing BFF). */
  get port(): number {
    return Number(this.config.get<string>('PORT')) || 4000;
  }

  get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * App data DB — its OWN database (`mc_demo`) on the shared compose Postgres.
   * NEVER the gateway's `mc_gateway`.
   */
  get db(): AppDbConfig {
    return {
      host: this.config.get<string>('DEMO_DB_HOST') ?? DB_DEFAULTS.host,
      port: Number(this.config.get<string>('DEMO_DB_PORT')) || DB_DEFAULTS.port,
      user: this.config.get<string>('DEMO_DB_USER') ?? DB_DEFAULTS.user,
      password:
        this.config.get<string>('DEMO_DB_PASSWORD') ?? DB_DEFAULTS.password,
      database: this.config.get<string>('DEMO_DB_NAME') ?? DB_DEFAULTS.database,
    };
  }
}
