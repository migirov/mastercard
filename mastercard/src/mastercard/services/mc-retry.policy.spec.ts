import {
  backoffMs,
  isTransientStatus,
  maxAttemptsFor,
} from './mc-retry.policy';

describe('mc-retry.policy', () => {
  it('retries an idempotent GET (3 attempts), nothing else', () => {
    expect(maxAttemptsFor('GET')).toBe(3);
    expect(maxAttemptsFor('POST')).toBe(1);
    expect(maxAttemptsFor('PUT')).toBe(1);
    expect(maxAttemptsFor('DELETE')).toBe(1);
  });

  it('treats 502/503/504 as transient, other statuses not', () => {
    expect(isTransientStatus(502)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientStatus(504)).toBe(true);
    expect(isTransientStatus(500)).toBe(false);
    expect(isTransientStatus(429)).toBe(false);
    expect(isTransientStatus(200)).toBe(false);
  });

  it('linear backoff: 200ms then 400ms', () => {
    expect(backoffMs(1)).toBe(200);
    expect(backoffMs(2)).toBe(400);
  });
});
