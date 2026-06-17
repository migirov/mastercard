import { McCredentials } from '../credentials.types';
import { OwnCredentialsCache } from './own-credentials.cache';

const creds = (id: string): McCredentials =>
  ({ consumerKey: id }) as McCredentials;

describe('OwnCredentialsCache', () => {
  it('stampede: concurrent getOrCreate of one id → factory runs once', async () => {
    const cache = new OwnCredentialsCache(600_000);
    const factory = jest.fn(async () => creds('acme'));
    await Promise.all([
      cache.getOrCreate('acme', factory),
      cache.getOrCreate('acme', factory),
      cache.getOrCreate('acme', factory),
    ]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('returns the cached resolution on a hit (no second factory call)', async () => {
    const cache = new OwnCredentialsCache(600_000);
    const factory = jest.fn(async () => creds('x'));
    await cache.getOrCreate('x', factory);
    await cache.getOrCreate('x', factory);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('LRU: size stays within the ceiling; the oldest is evicted', async () => {
    const cache = new OwnCredentialsCache(600_000, 500);
    for (let i = 0; i < 600; i++) {
      await cache.getOrCreate(`t${i}`, async () => creds(`t${i}`));
    }
    expect(cache.size).toBeLessThanOrEqual(500);

    // t599 is freshly inserted → still cached (factory not called again);
    // t0 was evicted past the ceiling → re-resolving it calls the factory.
    const fresh = jest.fn(async () => creds('t599'));
    await cache.getOrCreate('t599', fresh);
    expect(fresh).not.toHaveBeenCalled();

    const evicted = jest.fn(async () => creds('t0'));
    await cache.getOrCreate('t0', evicted);
    expect(evicted).toHaveBeenCalledTimes(1);
  });

  it('a rejected resolution is evicted (does not stick for the TTL)', async () => {
    const cache = new OwnCredentialsCache(600_000);
    const fail = jest.fn().mockRejectedValueOnce(new Error('vault down'));
    await expect(cache.getOrCreate('x', fail as never)).rejects.toThrow();
    expect(cache.size).toBe(0);

    // next resolve re-runs the factory (the failed entry was not cached)
    const ok = jest.fn(async () => creds('x'));
    await cache.getOrCreate('x', ok);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('expired entries are re-resolved (TTL)', async () => {
    const cache = new OwnCredentialsCache(0); // immediate expiry
    const factory = jest.fn(async () => creds('x'));
    await cache.getOrCreate('x', factory);
    await cache.getOrCreate('x', factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('invalidate drops an entry', async () => {
    const cache = new OwnCredentialsCache(600_000);
    const factory = jest.fn(async () => creds('x'));
    await cache.getOrCreate('x', factory);
    cache.invalidate('x');
    await cache.getOrCreate('x', factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
