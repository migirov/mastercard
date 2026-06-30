import { liveOrDemo } from './live-or-demo';

describe('liveOrDemo', () => {
  it('returns the live result when in live mode and tryLive succeeds', async () => {
    const r = await liveOrDemo(
      true,
      async () => 'live',
      () => 'demo',
    );
    expect(r).toBe('live');
  });

  it('falls back to demo when in live mode but tryLive returns undefined', async () => {
    const r = await liveOrDemo(
      true,
      async () => undefined,
      () => 'demo',
    );
    expect(r).toBe('demo');
  });

  it('uses demo WITHOUT calling tryLive when not live', async () => {
    const tryLive = jest.fn(async () => 'live');
    const r = await liveOrDemo(false, tryLive, () => 'demo');
    expect(r).toBe('demo');
    expect(tryLive).not.toHaveBeenCalled();
  });
});
