import { McCredentials } from '../credentials.types';

interface CacheEntry {
  /** Cache the Promise itself so concurrent requests reuse one resolution. */
  promise: Promise<McCredentials>;
  expiresAt: number;
}

/**
 * Hard ceiling on OWN cache entries (on top of TTL): without it a large
 * legitimate set of OWN partners (or a future bulk onboarding) would grow
 * unbounded on each pod, holding full key material. On overflow we evict
 * least-recently-used.
 */
const OWN_CACHE_MAX = 500;

/**
 * Resolved-credentials cache for OWN tenants — the caching concern extracted
 * from CredentialsService (issue #14). Combines three behaviours:
 *   - TTL expiry (rotation horizon for merchant keys);
 *   - LRU ceiling (`OWN_CACHE_MAX`) so memory is bounded by the active set;
 *   - stampede dedup (concurrent resolves of one id share a single Promise).
 * A rejected resolution is evicted so a transient failure does not stick for
 * the whole TTL.
 */
export class OwnCredentialsCache {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize: number = OWN_CACHE_MAX,
  ) {}

  /**
   * Return the cached (fresh) resolution for `id`, otherwise create it via
   * `factory`, store it, and return it. The factory runs at most once per live
   * entry (stampede dedup).
   */
  getOrCreate(
    id: string,
    factory: () => Promise<McCredentials>,
  ): Promise<McCredentials> {
    const now = Date.now();
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > now) {
      // recency for LRU: move to the end (most-recently-used); TTL untouched.
      this.cache.delete(id);
      this.cache.set(id, cached);
      return cached.promise;
    }

    // On a cache miss, sweep expired entries: otherwise the map would grow by
    // the number of ALL tenants ever resolved (holding their PEM keys), not by
    // the active set. The map is small (≈ number of OWN partners) → O(n) is
    // fine, no timer needed.
    for (const [k, e] of this.cache) {
      if (e.expiresAt <= now) this.cache.delete(k);
    }

    const promise = factory();
    const entry: CacheEntry = { promise, expiresAt: Date.now() + this.ttlMs };
    this.cache.set(id, entry);
    // Hard ceiling (LRU): after insert, evict the oldest beyond the limit.
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined || oldest === id) break;
      this.cache.delete(oldest);
    }
    // Evict a rejected resolution so a failure does not stick for the TTL.
    promise.catch(() => {
      if (this.cache.get(id) === entry) this.cache.delete(id);
    });
    return promise;
  }

  /** Drop a cached entry (e.g. on merchant key rotation). */
  invalidate(id: string): void {
    this.cache.delete(id);
  }

  /** Current entry count — for tests / introspection. */
  get size(): number {
    return this.cache.size;
  }
}
