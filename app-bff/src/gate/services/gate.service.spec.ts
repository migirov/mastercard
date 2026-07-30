import { AppConfig } from '../../config/app-config';
import { verifyGateProof } from '../../common/utils/gate-proof.util';
import { GateService } from './gate.service';

const PASSWORD = 'gate-password-value';
const SECRET = 'gate-session-secret-value';

function make(
  configured: string = PASSWORD,
  secret: string = SECRET,
  ttlHours = 12,
): GateService {
  const cfg = {
    demoGatePassword: configured,
    demoGateSecret: secret,
    demoGateTtlHours: ttlHours,
  } as unknown as AppConfig;
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

describe('GateService.issueProof', () => {
  it('mints a proof that verifies under the configured secret', () => {
    const { proof } = make().issueProof();
    expect(verifyGateProof(proof, SECRET)).toBe(true);
  });

  it('applies the configured TTL, in hours', () => {
    const before = Date.now();
    const { expiresAt } = make(PASSWORD, SECRET, 1).issueProof();
    // Second-granularity signing means the expiry can land up to a second early; allow for it.
    expect(expiresAt).toBeGreaterThan(before + 3600 * 1000 - 1500);
    expect(expiresAt).toBeLessThanOrEqual(before + 3600 * 1000);
  });

  // The proof a client is handed must not carry the password. A proof is a bearer of "someone knew
  // the password", never a copy of it.
  it('does not embed the password or the secret', () => {
    const { proof } = make().issueProof();
    expect(proof).not.toContain(PASSWORD);
    expect(proof).not.toContain(SECRET);
  });

  // Signing is unconditional by design (the controller checks the password first), so an
  // unconfigured secret must produce something nothing will accept rather than something forgeable.
  it('mints a proof no verifier accepts when the secret is unconfigured', () => {
    const { proof } = make(PASSWORD, '').issueProof();
    expect(verifyGateProof(proof, '')).toBe(false);
    expect(verifyGateProof(proof, SECRET)).toBe(false);
  });
});
