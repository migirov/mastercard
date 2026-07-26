import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts a valid config and returns the ORIGINAL object (unknown keys kept)', () => {
    const cfg = { XBS_QUOTE_MODE: 'live', PORT: '4000', SOME_UNKNOWN: 'x' };
    expect(validateEnv(cfg)).toBe(cfg);
  });

  it('tolerates an EMPTY xbs mode (treated as unset, not a crash)', () => {
    expect(() => validateEnv({ XBS_PAYMENT_MODE: '' })).not.toThrow();
  });

  it('rejects an invalid xbs mode', () => {
    expect(() => validateEnv({ XBS_QUOTE_MODE: 'nope' })).toThrow(
      /Invalid \.env/,
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/Invalid \.env/);
  });

  // DEMO_API_TOKEN is deliberately NOT required by the schema: an absent token must not abort
  // startup here with a bare Zod message. main.ts owns that decision (throw in production,
  // warn otherwise) because that is where the consequence can be spelled out, and the guard
  // denies every request either way.
  it('does not reject a missing DEMO_API_TOKEN — main.ts owns that decision', () => {
    expect(() => validateEnv({})).not.toThrow();
  });

  it('accepts DEMO_API_TOKEN and CORS_ORIGINS, keeping the original values', () => {
    const cfg = { DEMO_API_TOKEN: 'tok', CORS_ORIGINS: 'http://a,http://b' };
    expect(validateEnv(cfg)).toBe(cfg);
  });

  // `DEMO_API_TOKEN=` in a .env or compose file must read as "unset", not as a configured
  // empty secret — the empty case is the one that has to fail closed at the guard.
  it('accepts an empty DEMO_API_TOKEN (treated as unset, not as a valid secret)', () => {
    expect(() =>
      validateEnv({ DEMO_API_TOKEN: '', CORS_ORIGINS: '' }),
    ).not.toThrow();
  });
});
