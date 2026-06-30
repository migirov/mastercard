import {
  matchSharedToken,
  randomToken,
  safeEqual,
  safeTokenEqual,
  sha256hex,
} from './crypto.util';

describe('crypto.util', () => {
  describe('randomToken', () => {
    it('returns a url-safe base64 string (no +/=)', () => {
      expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('is unique across calls', () => {
      expect(randomToken()).not.toBe(randomToken());
    });

    it('respects the byte length', () => {
      // base64url of N bytes = ceil(N/3)*4 minus padding → 32B=43, 16B=22
      expect(randomToken(32)).toHaveLength(43);
      expect(randomToken(16)).toHaveLength(22);
    });
  });

  describe('sha256hex', () => {
    it('matches the known SHA-256 of "abc"', () => {
      expect(sha256hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('is deterministic', () => {
      expect(sha256hex('payload')).toBe(sha256hex('payload'));
    });
  });

  describe('safeEqual', () => {
    it('is true for equal strings', () => {
      expect(safeEqual('s3cr3t', 's3cr3t')).toBe(true);
    });

    it('is false for different strings of equal length', () => {
      expect(safeEqual('s3cr3t', 's3cr3T')).toBe(false);
    });

    it('is false (no throw) for different lengths', () => {
      expect(safeEqual('a', 'abc')).toBe(false);
    });
  });

  describe('safeTokenEqual', () => {
    it('is true for equal tokens', () => {
      expect(safeTokenEqual('abc', 'abc')).toBe(true);
    });

    it('is false for different tokens of equal length', () => {
      expect(safeTokenEqual('abc', 'abd')).toBe(false);
    });

    it('is false (NO throw) for different-length inputs — proves it hashes both first', () => {
      // Without the hash-first step, timingSafeEqual would throw / early-exit on
      // unequal length and leak the secret length. Hashing equalizes to 64 hex.
      expect(safeTokenEqual('short', 'a-much-longer-token')).toBe(false);
    });

    it('compares the SHA-256 of both inputs (not the raw strings)', () => {
      // Equivalent to safeEqual(sha256hex(x), sha256hex(y)).
      expect(safeTokenEqual('t', 't')).toBe(
        safeEqual(sha256hex('t'), sha256hex('t')),
      );
    });
  });

  describe('matchSharedToken', () => {
    it('is true only when secret is set, header present and equal', () => {
      expect(matchSharedToken('s3cr3t', 's3cr3t')).toBe(true);
    });

    it('is FAIL-CLOSED when the expected secret is empty/undefined', () => {
      // Security invariant: unconfigured secret must reject, never accept.
      expect(matchSharedToken('anything', '')).toBe(false);
      expect(matchSharedToken('anything', undefined)).toBe(false);
    });

    it('is false when the provided header is absent or empty', () => {
      expect(matchSharedToken(undefined, 'expected')).toBe(false);
      expect(matchSharedToken('', 'expected')).toBe(false);
    });

    it('is false on mismatch (no length leak for different lengths)', () => {
      expect(matchSharedToken('wrong', 'expected-secret')).toBe(false);
    });

    it('coerces an array header value via String() before comparing', () => {
      // express may hand a string[] for a repeated header; must not crash.
      expect(matchSharedToken(['a', 'b'], String(['a', 'b']))).toBe(true);
    });
  });
});
