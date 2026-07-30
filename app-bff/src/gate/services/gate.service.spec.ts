import { AppConfig } from '../../config/app-config';
import { GateService } from './gate.service';

const PASSWORD = 'gate-password-value';

function make(configured: string = PASSWORD): GateService {
  const cfg = { demoGatePassword: configured } as unknown as AppConfig;
  return new GateService(cfg);
}

describe('GateService', () => {
  it('accepts the configured password', () => {
    expect(make().verify(PASSWORD)).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(make().verify('nope')).toBe(false);
  });

  // The fail-closed invariant, and the one that matters most: an unconfigured password must DENY
  // every attempt, including an empty submission. Getting this backwards would turn a missing env
  // var into a gate that opens for anyone who presses Enter.
  it('denies every attempt when no password is configured — including an empty one', () => {
    expect(make('').verify(PASSWORD)).toBe(false);
    expect(make('').verify('')).toBe(false);
  });

  it('rejects an empty submission against a configured password', () => {
    expect(make().verify('')).toBe(false);
  });

  // Pins the no-trimming decision. A pasted value with a stray trailing space is a WRONG password,
  // not a match: trimming would silently widen the accepted set, and an operator who set the
  // variable with trailing whitespace would never discover it.
  it.each([
    ['trailing space', `${PASSWORD} `],
    ['leading space', ` ${PASSWORD}`],
    ['trailing newline', `${PASSWORD}\n`],
  ])('does not trim the submitted value (%s)', (_label, submitted) => {
    expect(make().verify(submitted)).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(make('Secret').verify('secret')).toBe(false);
  });

  // Both sides are sha256-hashed before comparison, so length is equalized and an oversized input
  // costs one hash rather than throwing or leaking the real password's length by timing.
  it('rejects a 100 kB submission without throwing', () => {
    expect(() => make().verify('x'.repeat(100_000))).not.toThrow();
    expect(make().verify('x'.repeat(100_000))).toBe(false);
  });
});
