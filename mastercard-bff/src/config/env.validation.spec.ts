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
});
