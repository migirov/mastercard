import { BoundedThrottlerStorage } from './bounded-throttler.storage';

describe('BoundedThrottlerStorage', () => {
  let nowSpy: jest.SpyInstance<number, []>;
  let t: number;

  beforeEach(() => {
    t = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => t);
  });
  afterEach(() => nowSpy.mockRestore());

  it('accumulates hits within a fixed window', async () => {
    const s = new BoundedThrottlerStorage();
    expect((await s.increment('k', 60_000)).totalHits).toBe(1);
    expect((await s.increment('k', 60_000)).totalHits).toBe(2);
    expect((await s.increment('k', 60_000)).totalHits).toBe(3);
  });

  it('resets the window once ttl has elapsed', async () => {
    const s = new BoundedThrottlerStorage();
    await s.increment('k', 60_000);
    expect((await s.increment('k', 60_000)).totalHits).toBe(2);
    t += 60_001; // window expired
    expect((await s.increment('k', 60_000)).totalHits).toBe(1);
  });

  it('timeToExpire is reported in seconds', async () => {
    const s = new BoundedThrottlerStorage();
    expect((await s.increment('k', 60_000)).timeToExpire).toBe(60);
  });

  it('evicts the least-recently-used key at capacity (bounds memory)', async () => {
    const s = new BoundedThrottlerStorage(2); // hold at most 2 keys
    await s.increment('a', 60_000);
    await s.increment('a', 60_000); // a=2, MRU order [a]
    await s.increment('b', 60_000); // b=1, order [a, b]
    await s.increment('c', 60_000); // size hits cap → evict LRU 'a' → order [b, c]

    // 'b' survived with its count; 'a' was dropped and starts fresh.
    expect((await s.increment('b', 60_000)).totalHits).toBe(2);
    expect((await s.increment('a', 60_000)).totalHits).toBe(1);
  });

  it('touching a key refreshes its LRU position (does not evict the active one)', async () => {
    const s = new BoundedThrottlerStorage(2);
    await s.increment('a', 60_000); // [a]
    await s.increment('b', 60_000); // [a, b]
    await s.increment('a', 60_000); // touch a → [b, a]; a=2
    await s.increment('c', 60_000); // evict LRU 'b' → [a, c]

    expect((await s.increment('a', 60_000)).totalHits).toBe(3); // a retained
    expect((await s.increment('b', 60_000)).totalHits).toBe(1); // b was evicted
  });
});
