import { Request } from 'express';
import { GateThrottlerGuard } from './gate-throttler.guard';

/**
 * `getTracker` is `protected`; exercise it through a subclass rather than a cast, so the test
 * breaks loudly if the base class ever renames it.
 */
class Probe extends GateThrottlerGuard {
  track(req: Partial<Request>): Promise<string> {
    return this.getTracker(req as Request);
  }
}

function guard(): Probe {
  // The base ThrottlerGuard's collaborators are never touched by getTracker.
  return new Probe(undefined as never, undefined as never, undefined as never);
}

describe('GateThrottlerGuard.getTracker', () => {
  it('uses req.ip when nothing is forwarded', async () => {
    await expect(guard().track({ headers: {}, ip: '10.1.2.3' })).resolves.toBe(
      'gate:10.1.2.3',
    );
  });

  it('prefers the first X-Forwarded-For entry (the original client)', async () => {
    await expect(
      guard().track({
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' },
        ip: '10.1.2.3',
      }),
    ).resolves.toBe('gate:203.0.113.9');
  });

  it('handles X-Forwarded-For arriving as an array', async () => {
    await expect(
      guard().track({
        headers: { 'x-forwarded-for': ['203.0.113.9', '198.51.100.7'] },
        ip: '10.1.2.3',
      }),
    ).resolves.toBe('gate:203.0.113.9');
  });

  // Regression test for a bucket-spoofing mistake that is easy to make in this stack, because our
  // own nginx.conf.template DOES set X-Real-IP and it therefore looks like the obvious key. It is
  // not: anyone who reaches the container port directly can send any X-Real-IP they like, minting
  // a fresh bucket per request and defeating the rate limit entirely.
  it('never keys off X-Real-IP', async () => {
    const tracker = await guard().track({
      headers: { 'x-real-ip': '198.51.100.7' },
      ip: '10.1.2.3',
    });
    expect(tracker).toBe('gate:10.1.2.3');
    expect(tracker).not.toContain('198.51.100.7');
  });

  it('falls back to a constant when there is no address at all', async () => {
    await expect(guard().track({ headers: {} })).resolves.toBe('gate:unknown');
  });

  // An empty or whitespace-only forwarded value must not produce the bucket 'gate:' — that would
  // pool every such caller into one key, which is the opposite of what an attacker-supplied blank
  // header should achieve.
  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])('ignores a blank X-Forwarded-For (%s)', async (_label, value) => {
    await expect(
      guard().track({ headers: { 'x-forwarded-for': value }, ip: '10.1.2.3' }),
    ).resolves.toBe('gate:10.1.2.3');
  });

  it('namespaces the key, so it cannot collide with another tracker', async () => {
    await expect(
      guard().track({ headers: {}, ip: '10.1.2.3' }),
    ).resolves.toMatch(/^gate:/);
  });
});
