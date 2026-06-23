import { Injectable } from '@nestjs/common';
import { isWeakSecret } from '../common/utils/secret-strength';

/**
 * Configuration for the embeddable module. The host application (b24club-api
 * or the dev harness) passes it via `MastercardModule.forRootAsync({ useFactory })`.
 * The module does NOT read `process.env` directly — so it can be dropped into a
 * foreign monolith without coupling to specific env-variable names.
 */
export interface MastercardModuleOptions {
  /** Mastercard base URL (sandbox/MTF/prod). */
  readonly baseUrl: string;
  /** Platform credentials (PLATFORM mode; OWN demo seed in dev). */
  readonly consumerKey: string;
  readonly partnerId: string;
  readonly signingKeyPath?: string;
  readonly signingKeyPassword?: string;
  /** Field-level encryption (JWE): enabled in MTF/Prod. */
  readonly encryptionEnabled?: boolean;
  readonly encryptionCertPath?: string;
  readonly encryptionFingerprint?: string;
  readonly decryptionKeyPath?: string;
  /** Merchant secrets source: 'local' (dev) | 'vault' (prod). */
  readonly secretStore?: 'local' | 'vault';
  /** OWN credentials cache TTL, ms. */
  readonly credsCacheTtlMs?: number;
  /** Signing secret for internal merchant JWTs. */
  readonly jwtSecret: string;
  /** Token for internal (service-to-service) calls. */
  readonly internalToken: string;
  /** Admin API token. */
  readonly adminToken: string;
  /** Shared secret for MC webhook authentication (required — guard fail-closed). */
  readonly webhookToken?: string;
  /**
   * Host environment. `'production'` enables prod gates (strong secrets + vault)
   * and disables seeding of test tenants. The host MUST pass it in prod; if it is
   * not passed, the module treats the environment as non-production (gates off).
   * The module does NOT read `process.env.NODE_ENV` itself — the value comes only
   * from here.
   */
  readonly nodeEnv?: string;
}

const DEFAULT_CREDS_TTL_MS = 10 * 60 * 1000;

/**
 * Typed access to module options. Replaces scattered `ConfigService.get(...)`
 * calls in the internal services — a single source of module configuration.
 * Provided globally by the umbrella `MastercardModule`, so it is available to
 * all sub-services.
 */
@Injectable()
export class GatewayConfig {
  constructor(private readonly opts: MastercardModuleOptions) {
    // Required options — fail-fast at STARTUP, not on the first request. Critical
    // for embedding: the host passes the options object directly, and the dev
    // harness env validation (ConfigModule.validate) does NOT run on this path.
    const required = [
      'baseUrl',
      'consumerKey',
      'partnerId',
      'jwtSecret',
      'internalToken',
      'adminToken',
    ] as const;
    for (const k of required) {
      if (!opts[k]) {
        throw new Error(`MastercardModule: required option '${k}' is missing`);
      }
    }
    // Prod gates: the module itself refuses to start in prod with weak secrets
    // or a dev secret store — identically standalone and embedded.
    if (this.isProduction) {
      const bad = (
        ['jwtSecret', 'internalToken', 'adminToken', 'webhookToken'] as const
      ).filter((k) => isWeakSecret(opts[k]));
      if (bad.length) {
        throw new Error(
          `production: weak/default secrets — set strong values: ${bad.join(', ')}`,
        );
      }
      if (this.secretStore !== 'vault') {
        throw new Error(
          'production: secretStore must be "vault" — LocalSecretStore is for dev only',
        );
      }
    }
  }

  get baseUrl(): string {
    return this.opts.baseUrl;
  }
  get consumerKey(): string {
    return this.opts.consumerKey;
  }
  get partnerId(): string {
    return this.opts.partnerId;
  }
  get signingKeyPath(): string | undefined {
    return this.opts.signingKeyPath;
  }
  get signingKeyPassword(): string | undefined {
    return this.opts.signingKeyPassword;
  }
  get encryptionEnabled(): boolean {
    return this.opts.encryptionEnabled ?? false;
  }
  get encryptionCertPath(): string | undefined {
    return this.opts.encryptionCertPath;
  }
  get encryptionFingerprint(): string | undefined {
    return this.opts.encryptionFingerprint;
  }
  get decryptionKeyPath(): string | undefined {
    return this.opts.decryptionKeyPath;
  }
  get secretStore(): 'local' | 'vault' {
    return this.opts.secretStore ?? 'local';
  }
  get credsCacheTtlMs(): number {
    return this.opts.credsCacheTtlMs && this.opts.credsCacheTtlMs > 0
      ? this.opts.credsCacheTtlMs
      : DEFAULT_CREDS_TTL_MS;
  }
  get jwtSecret(): string {
    return this.opts.jwtSecret;
  }
  get internalToken(): string {
    return this.opts.internalToken;
  }
  get adminToken(): string {
    return this.opts.adminToken;
  }
  get webhookToken(): string | undefined {
    return this.opts.webhookToken;
  }
  get isProduction(): boolean {
    // From host options only — the module is embeddable and does NOT read
    // process.env itself (otherwise it would couple to a specific env-variable
    // name in a foreign monolith). The host passes nodeEnv via forRootAsync
    // (the harness sources it from ConfigService NODE_ENV).
    return this.opts.nodeEnv === 'production';
  }

  /** Required value or a loud error (for keys needed in a specific mode). */
  require<K extends keyof MastercardModuleOptions>(
    key: K,
  ): NonNullable<MastercardModuleOptions[K]> {
    const v = this.opts[key];
    if (v === undefined || v === null || v === '') {
      throw new Error(
        `MastercardModule option '${String(key)}' is required but not set`,
      );
    }
    return v as NonNullable<MastercardModuleOptions[K]>;
  }
}
