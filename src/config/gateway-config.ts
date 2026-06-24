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
  /** Merchant secrets source: 'local' (dev) | 'aws-secrets-manager' (prod). */
  readonly secretStore?: 'local' | 'aws-secrets-manager';
  /**
   * AWS region for the secret store. Optional — when omitted the AWS SDK
   * resolves it from the standard chain (`AWS_REGION` / shared config).
   */
  readonly secretStoreRegion?: string;
  /** OWN credentials cache TTL, ms. */
  readonly credsCacheTtlMs?: number;
  /** Signing secret for internal merchant JWTs. */
  readonly jwtSecret: string;
  /** Token for internal (service-to-service) calls. */
  readonly internalToken: string;
  /** Admin API token. */
  readonly adminToken: string;
  /**
   * Shared secret for MC webhook authentication. Optional secondary/dev factor: in prod the
   * authoritative factor is in-app mTLS (below), since MC sends no token/header on push.
   */
  readonly webhookToken?: string;
  /**
   * Webhook auth: validate MC's client certificate IN THE APP (mTLS terminated by the app's
   * own HTTPS server via `requestCert`), never trusting the ingress. Required in prod — MC
   * authenticates push only via mTLS (no token/header), per the MC docs.
   */
  readonly webhookMtlsEnabled?: boolean;
  /**
   * Acceptable client-certificate subject CNs for the webhook (e.g.
   * `CrossborderServicesNotification-prod.mastercard.com`). The guard rejects any other CN.
   */
  readonly webhookAllowedClientCNs?: string[];
  /**
   * Host environment. `'production'` enables prod gates (strong secrets + the AWS
   * Secrets Manager store)
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
      const weak: string[] = (
        ['jwtSecret', 'internalToken', 'adminToken'] as const
      ).filter((k) => isWeakSecret(opts[k]));
      // webhookToken is now an OPTIONAL secondary factor; only weak-check it if it is set.
      if (opts.webhookToken && isWeakSecret(opts.webhookToken)) {
        weak.push('webhookToken');
      }
      if (weak.length) {
        throw new Error(
          `production: weak/default secrets — set strong values: ${weak.join(', ')}`,
        );
      }
      if (this.secretStore !== 'aws-secrets-manager') {
        throw new Error(
          'production: secretStore must be "aws-secrets-manager" — ' +
            'LocalSecretStore is for dev only',
        );
      }
      // Webhook authenticity must be decided IN THE APP, not the ingress: production validates
      // MC's client certificate in-app (mTLS terminated by the app). MC sends no token/header
      // on push, so the cert is the only factor that authenticates it.
      if (
        !this.webhookMtlsEnabled ||
        this.webhookAllowedClientCNs.length === 0
      ) {
        throw new Error(
          'production: enable in-app webhook mTLS — set webhookMtlsEnabled + ' +
            'webhookAllowedClientCNs (validate MC client cert in-app, not the ingress)',
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
  get secretStore(): 'local' | 'aws-secrets-manager' {
    return this.opts.secretStore ?? 'local';
  }
  get secretStoreRegion(): string | undefined {
    return this.opts.secretStoreRegion;
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
  get webhookMtlsEnabled(): boolean {
    return this.opts.webhookMtlsEnabled ?? false;
  }
  get webhookAllowedClientCNs(): string[] {
    return this.opts.webhookAllowedClientCNs ?? [];
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
