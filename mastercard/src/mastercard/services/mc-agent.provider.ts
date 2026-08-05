import { createHash } from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { MIN_TLS_VERSION } from '../../common/utils/tls';
import { loadSigningMaterialFromP12 } from '../../common/utils/p12.util';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { TenantMtlsUnavailableError } from './mc.errors';

/**
 * Hard ceiling on cached per-tenant agents. Deliberately smaller than the other
 * caches in this codebase (`OWN_JWE_CACHE_MAX`/`PEM_CACHE_MAX` are 256): each entry
 * pins up to `TENANT_MAX_FREE_SOCKETS` idle TLS sessions plus the certificate bytes,
 * so 256 would reserve four figures of file descriptors. 32 is far above any
 * realistic per-pod tenant count and bounds the worst case at
 * PLATFORM_MAX_SOCKETS + 32 x TENANT_MAX_SOCKETS file descriptors.
 */
const MTLS_AGENT_CACHE_MAX = 32;

/** Unchanged from the single-agent era — today's deployments behave identically. */
const PLATFORM_MAX_SOCKETS = 50;
const PLATFORM_MAX_FREE_SOCKETS = 10;

/**
 * A per-tenant agent serves ONE merchant, so it needs far less headroom than the
 * shared pool. NB: a lower cap makes queueing more likely per tenant — that is safe
 * because `MastercardClient` bounds total wall-clock per attempt with its own
 * AbortController regardless of how long a request waits for a socket.
 */
const TENANT_MAX_SOCKETS = 16;
const TENANT_MAX_FREE_SOCKETS = 4;

/** Warn this far ahead of a certificate expiring. */
const CERT_EXPIRY_WARN_DAYS = 30;

export interface McCertStatus {
  readonly notAfter?: string;
  readonly daysLeft?: number;
}

function daysUntil(d: Date): number {
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * Owns the outbound HTTPS agents, including the client certificate we present to
 * Mastercard (mTLS).
 *
 * Mastercard requires mTLS on the MTF and production PSD2 edges but not on sandbox.
 * Certificates are issued per organisation through their Key Management Portal, and
 * an OWN tenant with its own Mastercard project gets its own — so agents are keyed
 * by certificate, mirroring `EncryptionService`'s per-tenant `JweEncryption` cache.
 *
 * Selection is by PRESENCE of material on the credentials, exactly like
 * `EncryptionService.jweFor`: a tenant carrying its own certificate gets its own
 * agent, everyone else shares the platform one.
 *
 * A side benefit worth stating: sockets are never shared between tenants, so a
 * resumed TLS session can never carry one merchant's connection identity into
 * another merchant's request.
 */
@Injectable()
export class McAgentProvider implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(McAgentProvider.name);
  /** Shared agent: the platform certificate, or none when mTLS is off. */
  private base!: https.Agent;
  /** Per-tenant agents, keyed by a hash of the certificate bytes (LRU). */
  private readonly perTenant = new Map<string, https.Agent>();
  /** Extra trust anchors for MASTERCARD'S server certificate — shared by all agents. */
  private ca?: Buffer[];
  private platformCert?: McCertStatus;

  constructor(private readonly config: GatewayConfig) {}

  /** File I/O in a lifecycle hook, not the constructor — the convention here. */
  onModuleInit(): void {
    const tlsFloor = { minVersion: MIN_TLS_VERSION };
    const ca = this.config.mtlsCaPath
      ? [fs.readFileSync(this.config.mtlsCaPath)]
      : undefined;
    // Kept for the per-tenant agents too: which server certificates we accept is a
    // property of the ENDPOINT, not of whose client certificate we present.
    this.ca = ca;

    if (!this.config.mtlsEnabled) {
      this.base = new https.Agent({
        keepAlive: true,
        maxSockets: PLATFORM_MAX_SOCKETS,
        maxFreeSockets: PLATFORM_MAX_FREE_SOCKETS,
        scheduling: 'lifo',
        // Extra trust anchors apply even with no client certificate: `ca` governs how
        // we verify MASTERCARD'S server certificate, which is independent of whether
        // we present one of our own. Dropping it here would silently ignore a
        // configured MC_MTLS_CA_PATH and surface as an unverifiable-leaf failure.
        ca,
        ...tlsFloor,
      });
      this.logger.log(
        'Outbound mTLS disabled — no client certificate presented to Mastercard',
      );
      return;
    }

    const certPath = this.config.require('mtlsClientCertPath');
    const passphrase = this.config.require('mtlsClientCertPassword');
    const pfx = fs.readFileSync(certPath);
    // Metadata only: the RAW pfx goes to Node so the whole chain is presented.
    const meta = loadSigningMaterialFromP12(certPath, passphrase);
    if (!meta.certThumbprintS256) {
      throw new Error(
        `MastercardModule: the outbound mTLS keystore '${certPath}' contains a ` +
          'private key but no certificate — it cannot be presented to Mastercard',
      );
    }
    this.platformCert = this.describe(meta.certNotAfter, 'client');

    this.base = new https.Agent({
      keepAlive: true,
      maxSockets: PLATFORM_MAX_SOCKETS,
      maxFreeSockets: PLATFORM_MAX_FREE_SOCKETS,
      scheduling: 'lifo',
      pfx,
      passphrase,
      ca,
      ...tlsFloor,
    });
    this.logger.log(
      `Outbound mTLS enabled (client certificate ${certPath}` +
        `${this.platformCert.notAfter ? `, expires ${this.platformCert.notAfter}` : ''})`,
    );
  }

  /**
   * The agent to use for this tenant's call.
   *
   * NOTE ON THE STATE OF THIS FEATURE: nothing populates `creds.mtls` today —
   * `MerchantSecretBundle` has no field for a client certificate, so neither
   * credentials provider can set one. The per-tenant branch below is therefore
   * dormant, kept because the selection idiom is right and a certificate is coming.
   * What is NOT dormant is the guard: without it an OWN tenant would silently
   * transact under the platform's TLS identity the day mTLS is switched on.
   */
  agentFor(creds: McCredentials): https.Agent {
    if (creds.mtls) return this.tenantAgentFor(creds.mtls);
    if (this.config.mtlsRequiredForHost && this.isOwnIdentity(creds)) {
      throw new TenantMtlsUnavailableError(
        `Tenant credentials use their own Mastercard identity (consumer key / ` +
          `partner-id '${creds.partnerId}') but carry no client certificate, and ` +
          `${this.config.baseUrl} requires outbound mTLS. Refusing to present the ` +
          'platform certificate on their behalf: Mastercard would see one ' +
          "organisation's certificate authenticating another's partner account.",
      );
    }
    return this.base;
  }

  /**
   * Whether these credentials are a tenant's OWN Mastercard identity rather than the
   * platform's. The same comparison `OwnCredentialsProvider.assertNotPlatformIdentity`
   * already trusts, inverted — `McCredentials` carries no credential mode, and
   * threading one through purely for this would touch the whole credentials surface
   * without making the answer any more certain.
   */
  private isOwnIdentity(creds: McCredentials): boolean {
    return (
      creds.consumerKey !== this.config.consumerKey ||
      creds.partnerId !== this.config.partnerId
    );
  }

  /** Expiry of the platform client certificate, for health/observability. */
  get clientCertStatus(): McCertStatus | undefined {
    return this.platformCert;
  }

  onApplicationShutdown(): void {
    // Every agent, not just the base: a keep-alive pool left undestroyed holds the
    // event loop open on graceful shutdown, module re-init and test teardown.
    this.base?.destroy();
    for (const agent of this.perTenant.values()) agent.destroy();
    this.perTenant.clear();
  }

  private tenantAgentFor(
    mtls: NonNullable<McCredentials['mtls']>,
  ): https.Agent {
    // Keyed on the certificate BYTES, never on the `thumbprintS256` string that
    // arrives with the credentials. That string comes from a merchant secret bundle,
    // and this key decides which TLS identity a request is made under: two tenants
    // carrying the same string — by mistake or otherwise — would share an agent, and
    // one would present the other merchant's client certificate to Mastercard.
    // The passphrase is folded in because the same bytes with a different passphrase
    // are a different, and unopenable, keystore. Same idiom as `p12.util`'s
    // content-addressed PEM cache.
    const key = createHash('sha256')
      .update(mtls.pfx)
      .update('\0')
      .update(mtls.passphrase)
      .digest('hex');
    const cached = this.perTenant.get(key);
    if (cached) {
      // Recency: re-insert so the LRU eviction below drops the coldest entry.
      this.perTenant.delete(key);
      this.perTenant.set(key, cached);
      return cached;
    }

    const agent = new https.Agent({
      keepAlive: true,
      maxSockets: TENANT_MAX_SOCKETS,
      maxFreeSockets: TENANT_MAX_FREE_SOCKETS,
      scheduling: 'lifo',
      pfx: mtls.pfx,
      passphrase: mtls.passphrase,
      ca: this.ca,
      minVersion: MIN_TLS_VERSION,
    });
    this.perTenant.set(key, agent);
    this.describe(mtls.notAfter, `tenant ${key.slice(0, 8)}`);
    this.evictOverflow();
    return agent;
  }

  /** LRU eviction that DESTROYS what it drops — otherwise the sockets leak. */
  private evictOverflow(): void {
    while (this.perTenant.size > MTLS_AGENT_CACHE_MAX) {
      const oldest = this.perTenant.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.perTenant.get(oldest)?.destroy();
      this.perTenant.delete(oldest);
      this.logger.warn(
        `Evicted the mTLS agent for ${oldest.slice(0, 8)} at capacity ` +
          `${MTLS_AGENT_CACHE_MAX} — its warm TLS sessions are gone. Frequent ` +
          'evictions mean the cache is too small for the active tenant count.',
      );
    }
  }

  /** Log the certificate's remaining life; never throws, an expired cert still boots. */
  private describe(notAfter: Date | undefined, label: string): McCertStatus {
    if (!notAfter) return {};
    const daysLeft = daysUntil(notAfter);
    const iso = notAfter.toISOString().slice(0, 10);
    const msg = `Mastercard ${label} certificate expires ${iso} (${daysLeft} days)`;
    if (daysLeft < 0) {
      // Loud, but not fatal: refusing to boot an embedded module inside a foreign
      // monolith over an expired certificate is worse than a red log line plus the
      // handshake error the call itself will produce.
      this.logger.error(`${msg} — ALREADY EXPIRED`);
    } else if (daysLeft <= CERT_EXPIRY_WARN_DAYS) {
      this.logger.warn(msg);
    } else {
      this.logger.log(msg);
    }
    return { notAfter: iso, daysLeft };
  }
}
