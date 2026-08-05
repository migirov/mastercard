import { Injectable } from '@nestjs/common';
import { isWeakSecret } from '../common/utils/secret-strength';
import { McAuthMode } from '../mastercard/auth/mc-auth.types';

/**
 * Configuration for the embeddable module. The host application (b24club-api
 * or the dev harness) passes it via `MastercardModule.forRootAsync({ useFactory })`.
 * The module does NOT read `process.env` directly — so it can be dropped into a
 * foreign monolith without coupling to specific env-variable names.
 */
export interface MastercardModuleOptions {
  /** Mastercard base URL (sandbox/MTF/prod). */
  readonly baseUrl: string;
  /**
   * Outbound auth scheme. Omitted = 'oauth1' (the `.com` endpoints). The PSD2 edges
   * `*.api.xbs.mastercard.eu|uk` require 'oauth2-request-token'; the constructor
   * enforces that pairing.
   */
  readonly authMode?: McAuthMode;
  /**
   * Outbound mTLS: the client certificate WE PRESENT to Mastercard, issued through
   * their Key Management Portal. Required on the MTF and production PSD2 edges, not
   * on sandbox. Do NOT confuse with `webhookMtls*` (validates Mastercard's cert on
   * INBOUND push) or the harness `TLS_*` vars (our own HTTPS listener).
   */
  readonly mtlsEnabled?: boolean;
  readonly mtlsClientCertPath?: string;
  readonly mtlsClientCertPassword?: string;
  /** Extra trust anchors for Mastercard's SERVER certificate. Usually unnecessary. */
  readonly mtlsCaPath?: string;
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
   * Acceptable client-certificate ISSUER (CA) CNs for the webhook — the leaf's immediate
   * issuer, e.g. `DigiCert Assured ID Client CA G2` (MC's outbound chain, per the MC docs).
   * Pinning the issuer (not just `authorized` + subject CN) prevents a broadly-trusted CA
   * bundle from letting any cert with the right subject CN through. Required in production.
   */
  readonly webhookAllowedIssuerCNs?: string[];
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
 * The only PSD2 hosts where Mastercard does NOT want a client certificate ("For
 * Sandbox EU/UK domain testing, mTLS certificate is not needed"). Everything else
 * under `xbs.mastercard.eu|uk` — MTF and production — requires one.
 */
const SANDBOX_PSD2_HOSTS: ReadonlySet<string> = new Set([
  'sandbox.api.xbs.mastercard.eu',
  'sandbox.api.xbs.mastercard.uk',
]);

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
    // Order matters: a `.com` host on the wrong auth mode must report the auth-mode
    // problem (the root cause), not a confusing mTLS one.
    this.assertAuthModeMatchesHost();
    this.assertMtlsMatchesHost();
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
        this.webhookAllowedClientCNs.length === 0 ||
        this.webhookAllowedIssuerCNs.length === 0
      ) {
        throw new Error(
          'production: enable in-app webhook mTLS — set webhookMtlsEnabled + ' +
            'webhookAllowedClientCNs + webhookAllowedIssuerCNs (validate MC client cert ' +
            'subject AND pin its issuer CA in-app, not the ingress)',
        );
      }
      // Field-level encryption is the fourth prod requirement, and it was the one missing here
      // while the other three were enforced. `encryptionEnabled` defaults to false and ships
      // false in .env.example, so an operator following the documented setup got a production
      // gateway putting beneficiary PII on the wire as plaintext JSON — announced by a single
      // boot line that is easy to miss. Mastercard mandates FLE in production anyway, so the
      // only question was whether it fails at boot or on the first real payment.
      if (!this.encryptionEnabled) {
        throw new Error(
          'production: enable field-level encryption — set encryptionEnabled (Mastercard ' +
            'requires FLE in production; leaving it off sends beneficiary PII as plaintext)',
        );
      }
    }
  }

  get baseUrl(): string {
    return this.opts.baseUrl;
  }

  /** Outbound auth scheme. Defaults to OAuth 1.0a — the pre-existing behaviour. */
  get authMode(): McAuthMode {
    return this.opts.authMode ?? 'oauth1';
  }

  /**
   * Refuse a host/mode mismatch at STARTUP rather than failing every call at
   * runtime. Mastercard's PSD2 edges (`*.api.xbs.mastercard.eu|uk`) reject OAuth 1.0a
   * with the same error they give an unauthenticated request, and the `.com`
   * endpoints do not accept a request token — so the two must be changed together.
   * Editing `MC_BASE_URL` and forgetting `MC_AUTH_MODE` is the likeliest way to
   * break this, and it would otherwise surface as opaque 502s on every payment.
   */
  /**
   * Hostname of the configured Mastercard endpoint, NORMALISED for the gates below.
   *
   * Two normalisations, both of which are the difference between a gate that fires
   * and one that silently does not:
   *
   *  - the scheme must be `https:`. On `http://` axios uses the http adapter and
   *    ignores `httpsAgent` entirely — so the client certificate would not be
   *    presented while `mtlsRequiredForHost` cheerfully reported "satisfied", and
   *    every request token would go out in cleartext.
   *  - a trailing dot is stripped. `api.xbs.mastercard.eu.` is a valid absolute FQDN
   *    that resolves to the very same host, but it matches neither the PSD2 pattern
   *    nor the sandbox exemption — so the deployment would boot against PRODUCTION
   *    with OAuth 1.0a and no client certificate, and both gates would stay quiet.
   */
  private get upstreamHost(): string {
    let url: URL;
    try {
      url = new URL(this.opts.baseUrl);
    } catch {
      throw new Error(
        `MastercardModule: option 'baseUrl' is not a valid URL: ${this.opts.baseUrl}`,
      );
    }
    if (url.protocol !== 'https:') {
      throw new Error(
        `MastercardModule: option 'baseUrl' must use https (got '${url.protocol}' ` +
          `in '${this.opts.baseUrl}'). Over plain http the outbound client ` +
          'certificate is silently ignored and credentials travel in cleartext.',
      );
    }
    return url.hostname.toLowerCase().replace(/\.+$/, '');
  }

  /**
   * A PSD2 edge (`*.xbs.mastercard.eu|uk`) — the endpoints Mastercard requires for
   * customers contracted with MTS EU / MTS UK. One predicate, used by both the
   * auth-mode gate and the mTLS gate, so the two cannot drift apart.
   *
   * Deliberately broader than the `*.api.xbs.…` hosts Mastercard publishes today:
   * matching any host under `xbs.mastercard.eu|uk` fails CLOSED, so a future or
   * regional edge still gets the request token and the certificate requirement.
   * Narrowing this to the documented shape would re-open exactly that hole.
   */
  private get isPsd2Edge(): boolean {
    return /\.xbs\.mastercard\.(eu|uk)$/.test(this.upstreamHost);
  }

  /**
   * Whether Mastercard requires a client certificate on this endpoint.
   *
   * Derived from the hostname rather than `NODE_ENV`, and deliberately so: a
   * production gate would demand a certificate on a `.com` production deployment
   * (where Mastercard does not want one) and would NOT fire on MTF — which is not
   * `NODE_ENV=production` but is exactly where the certificate first becomes
   * mandatory. Only the sandbox edge is exempt (per Mastercard's own mTLS setup
   * guide: "For Sandbox EU/UK domain testing, mTLS certificate is not needed").
   *
   * NB: this encodes Mastercard's per-ENVIRONMENT rule via the hostname, which is
   * our proxy for it. Do not "improve" it into a NODE_ENV check.
   *
   * The exemption is an EXACT host list, not a `sandbox.` prefix test: a prefix
   * matches anything merely beginning with it — `sandbox.mtf.api.xbs.mastercard.eu`
   * would be waved through — and the exemption is the one place here where being
   * wrong means presenting no certificate at all.
   */
  get mtlsRequiredForHost(): boolean {
    return this.isPsd2Edge && !SANDBOX_PSD2_HOSTS.has(this.upstreamHost);
  }

  /** Outbound mTLS enabled — we present a client certificate to Mastercard. */
  get mtlsEnabled(): boolean {
    return this.opts.mtlsEnabled ?? false;
  }

  /** Extra trust anchors for Mastercard's SERVER certificate, if MC supplied any. */
  get mtlsCaPath(): string | undefined {
    return this.opts.mtlsCaPath;
  }

  /**
   * Refuse a host that mandates mTLS while it is switched off — otherwise every
   * call fails at the TLS handshake and surfaces as an opaque 502.
   */
  private assertMtlsMatchesHost(): void {
    if (this.mtlsRequiredForHost && !this.mtlsEnabled) {
      throw new Error(
        `MastercardModule: baseUrl '${this.upstreamHost}' requires outbound mTLS — ` +
          `set mtlsEnabled together with mtlsClientCertPath/mtlsClientCertPassword ` +
          `(the client certificate issued through Mastercard's Key Management ` +
          `Portal). Only the sandbox PSD2 edge may be reached without one.`,
      );
    }
  }

  private assertAuthModeMatchesHost(): void {
    const host = this.upstreamHost;
    const isPsd2Edge = this.isPsd2Edge;
    const mode = this.authMode;

    if (isPsd2Edge && mode !== 'oauth2-request-token') {
      throw new Error(
        `MastercardModule: baseUrl '${host}' is a PSD2 edge, which requires ` +
          `MC_AUTH_MODE=oauth2-request-token (got '${mode}')`,
      );
    }
    if (!isPsd2Edge && mode === 'oauth2-request-token') {
      throw new Error(
        `MastercardModule: MC_AUTH_MODE=oauth2-request-token is only accepted by ` +
          `the PSD2 edges (*.api.xbs.mastercard.eu|uk), but baseUrl is '${host}'`,
      );
    }
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
  get encryptionFingerprint(): string | undefined {
    return this.opts.encryptionFingerprint;
  }
  // NOTE: encryptionCertPath / decryptionKeyPath are intentionally NOT exposed as getters —
  // they are mandatory only when encryption is on, so every consumer reads them through the
  // fail-loud `require('encryptionCertPath' | 'decryptionKeyPath')` (see EncryptionService).
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
  get webhookAllowedIssuerCNs(): string[] {
    return this.opts.webhookAllowedIssuerCNs ?? [];
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
