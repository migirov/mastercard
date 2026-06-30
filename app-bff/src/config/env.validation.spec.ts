import { validateEnv } from './env.validation';

describe('validateEnv (app-bff)', () => {
  it('accepts a valid config and returns the ORIGINAL object (unknown keys kept)', () => {
    const cfg = { PORT: '4000', DEMO_DB_HOST: 'postgres', SOME_UNKNOWN: 'x' };
    expect(validateEnv(cfg)).toBe(cfg);
  });

  it('ignores cross-border vars (app-bff does not validate them)', () => {
    // mastercard-only vars are unknown keys here → passed through, not rejected.
    expect(() => validateEnv({ XBS_QUOTE_MODE: 'nope' })).not.toThrow();
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/Invalid \.env/);
  });

  it('rejects a non-numeric DEMO_DB_PORT', () => {
    expect(() => validateEnv({ DEMO_DB_PORT: 'abc' })).toThrow(/Invalid \.env/);
  });
});
