/** Default key cap. Beyond this, the least-recently-used key is evicted. */
const DEFAULT_MAX_KEYS = 10_000;

/** The `@nestjs/throttler` ThrottlerStorageRecord shape (structural — see class note). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
}

interface Window {
  totalHits: number;
  expiresAt: number; // epoch ms
}

/**
 * A size-capped, timer-free `ThrottlerStorage`.
 *
 * Implemented structurally (no `implements`/type import): `@nestjs/throttler` exports the name
 * `ThrottlerStorage` as BOTH an interface and a DI symbol, and the `storage?:` option accepts
 * any object with a matching `increment(key, ttl)` — so structural typing keeps this decoupled
 * from that dual export.
 *
 * The library's default `ThrottlerStorageService` keeps one entry PER DISTINCT KEY and never
 * evicts it, and arms a `setTimeout` on every hit whose handler does an O(n) filter over all
 * pending timers. Two of this gateway's throttle trackers key on unauthenticated, caller-chosen
 * values (the OAuth `client_id`), so an attacker rotating that value grows the store without
 * bound (~440 bytes/key, never freed) and drives the per-hit drain quadratic — an unauthenticated
 * memory/CPU exhaustion on the one endpoint that must be public for merchants.
 *
 * This bounds the key space with LRU eviction and expires lazily (no timers at all). It trades
 * the library's rolling per-hit decrement for a FIXED window — a standard, predictable rate-limit
 * approximation that still enforces `limit` per `ttl`; the only observable difference is that the
 * window resets as a block rather than sliding, which is fine for abuse protection.
 */
export class BoundedThrottlerStorage {
  private readonly map = new Map<string, Window>();

  constructor(private readonly maxKeys: number = DEFAULT_MAX_KEYS) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const existing = this.map.get(key);

    let window: Window;
    if (!existing || existing.expiresAt <= now) {
      // New key, or its window has expired → start a fresh fixed window.
      this.map.delete(key); // drop any stale entry so re-insert lands at the LRU tail
      this.evictIfFull();
      window = { totalHits: 0, expiresAt: now + ttl };
    } else {
      // Live window → touch it (move to the tail = most-recently-used).
      this.map.delete(key);
      window = existing;
    }

    window.totalHits++;
    this.map.set(key, window);
    return {
      totalHits: window.totalHits,
      timeToExpire: Math.ceil((window.expiresAt - now) / 1000),
    };
  }

  /** Evict the least-recently-used key (Map preserves insertion order) when at capacity. */
  private evictIfFull(): void {
    if (this.map.size < this.maxKeys) return;
    const oldest = this.map.keys().next().value;
    if (oldest !== undefined) this.map.delete(oldest);
  }
}
