import {
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { caching, MemoryCache } from 'cache-manager';
import { GatewayConfig } from '../../config/gateway-config';
import {
  loadPrivateKeyFromP12,
  loadPrivateKeyFromP12Base64,
} from '../../common/utils/p12.util';
import { Tenant } from '../../tenants/tenant.types';
import {
  KeyMaterial,
  MerchantSecretBundle,
  SECRET_STORE,
  SecretStore,
} from '../../secrets/secret-store.types';
import { McCredentials } from '../credentials.types';
import { safePartnerId, safeSecretRef } from '../utils/credential-sanitize';

/**
 * Hard ceiling on OWN cache entries (LRU): a large set of OWN partners (or a
 * future bulk onboarding) must not grow the per-pod cache unboundedly while
 * holding full key material. On overflow the store evicts least-recently-used.
 */
const OWN_CACHE_MAX = 500;

/**
 * OWN credentials: a merchant's own keys from the SecretStore (AWS Secrets Manager),
 * fetched, validated and normalised to PEM, then cached. Caching is delegated to
 * cache-manager (in-memory store: TTL + LRU(500)); a rejected resolve is NOT
 * cached, so a transient failure does not stick. Issue #15 replaced the bespoke
 * OwnCredentialsCache with cache-manager.
 *
 * NB: cache-manager v5 `wrap` does not coalesce concurrent misses, so the former
 * in-flight stampede dedup is intentionally dropped — concurrent cold resolves of
 * one tenant may each hit the SecretStore (correct, just not coalesced).
 */
@Injectable()
export class OwnCredentialsProvider {
  private readonly logger = new Logger(OwnCredentialsProvider.name);
  private readonly ttlMs: number;
  // cache-manager's memory store is created asynchronously → lazy single init.
  private cache?: Promise<MemoryCache>;

  constructor(
    private readonly config: GatewayConfig,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
  ) {
    this.ttlMs = config.credsCacheTtlMs;
  }

  async get(tenant: Tenant): Promise<McCredentials> {
    const cache = await this.cacheStore();
    return cache.wrap(tenant.id, () => this.fetch(tenant));
  }

  /** Drop a merchant's cached credentials (for key rotation). */
  invalidate(tenantId: string): void {
    // Fire-and-forget: the store delete is async and must not throw to callers.
    void this.cacheStore()
      .then((c) => c.del(tenantId))
      .catch(() => undefined);
  }

  private cacheStore(): Promise<MemoryCache> {
    if (!this.cache) {
      const init = caching('memory', { max: OWN_CACHE_MAX, ttl: this.ttlMs });
      // If store init ever fails, clear the slot so the NEXT call retries rather
      // than permanently awaiting a poisoned (rejected) promise. (Does not mask
      // the rejection — the awaiting caller still sees it.)
      init.catch(() => {
        if (this.cache === init) this.cache = undefined;
      });
      this.cache = init;
    }
    return this.cache;
  }

  private async fetch(tenant: Tenant): Promise<McCredentials> {
    if (!tenant.secretRef) {
      // Incomplete tenant config — not a server crash (500) but "tenant is not
      // configured" → 422. Detail (id) to the log, not the response.
      this.logger.error(`Tenant '${tenant.id}' (OWN) has no secretRef`);
      throw new UnprocessableEntityException(
        'tenant credentials are not configured',
      );
    }
    const secretRef = safeSecretRef(tenant.secretRef, tenant.id);

    const bundle = await this.secrets.getMerchantSecrets(secretRef);
    this.validateBundle(secretRef, bundle);

    const creds: McCredentials = {
      consumerKey: bundle.consumerKey,
      // an explicit tenant partnerId wins, otherwise the one from the bundle
      partnerId: safePartnerId(tenant.partnerId ?? bundle.partnerId, tenant.id),
      signingKeyPem: this.toPem(bundle.signing),
      encryptionCertPem: bundle.encryptionCertPem,
      encryptionFingerprint: bundle.encryptionFingerprint,
      decryptionKeyPem: bundle.decryption
        ? this.toPem(bundle.decryption)
        : undefined,
    };

    this.assertNotPlatformIdentity(tenant.id, creds);

    this.logger.log(`OWN credentials for tenant '${tenant.id}' cached`);
    return creds;
  }

  /**
   * Enforce the OWN-isolation invariant the ownership gate relies on: an OWN tenant must
   * transact under its OWN Mastercard identity, never the platform's. The gate is a no-op for
   * OWN tenants precisely because Mastercard isolates them by their own partnerId — but nothing
   * else guarantees that. If an OWN tenant's resolved credentials collapse onto the platform's
   * consumerKey or partnerId (e.g. a `secretRef` pointed at the dev-seeded platform bundle
   * `mc/tenants/own-sandbox`, however the ref is spelled), it would sign as the platform while
   * being treated as self-isolated — the worst of both. Comparing the RESOLVED material, not the
   * ref string, closes that regardless of how the leak was configured. Reached only on a cold
   * cache miss (the result is cached), so the cost is negligible.
   */
  private assertNotPlatformIdentity(
    tenantId: string,
    creds: McCredentials,
  ): void {
    if (
      creds.consumerKey === this.config.consumerKey ||
      creds.partnerId === this.config.partnerId
    ) {
      this.logger.error(
        `Tenant '${tenantId}' (OWN) resolves to the PLATFORM's own Mastercard identity ` +
          `(consumerKey/partnerId) — refusing. An OWN tenant must use its own credentials; ` +
          `check that its secretRef/partnerId is not the platform's.`,
      );
      throw new UnprocessableEntityException(
        'tenant credentials are misconfigured',
      );
    }
  }

  /** Secret-boundary validation: the bundle must hold the minimum to sign. */
  private validateBundle(ref: string, b: MerchantSecretBundle): void {
    if (!b.consumerKey) {
      this.logger.error(`SecretStore '${ref}': missing consumerKey`);
      throw new UnprocessableEntityException(
        'credentials bundle is missing consumerKey',
      );
    }
    if (!b.signing) {
      this.logger.error(`SecretStore '${ref}': missing signing key material`);
      throw new UnprocessableEntityException(
        'credentials bundle is missing signing key material',
      );
    }
  }

  /** Normalise key material (path | base64) to PEM. */
  private toPem(key: KeyMaterial): string {
    if (key.p12Base64) {
      return loadPrivateKeyFromP12Base64(key.p12Base64, key.password);
    }
    if (key.p12Path) {
      return loadPrivateKeyFromP12(key.p12Path, key.password);
    }
    throw new UnprocessableEntityException('invalid key material');
  }
}
