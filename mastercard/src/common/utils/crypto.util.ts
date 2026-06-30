import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Cryptographically strong random token (url-safe base64). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 in hex. */
export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Constant-time string comparison (protection against timing attacks). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Constant-time comparison of a presented shared token with the expected one.
 * Hashing BOTH inputs before comparison is load-bearing: `timingSafeEqual` returns
 * early on differing lengths (leaking the secret's length), whereas sha256 equalizes
 * the length and lets you safely compare inputs of any length. The canonical
 * primitive for guards: don't repeat the `sha256hex`+`safeEqual` pairing by hand
 * (easy to forget the hash and return a length leak). See admin/tenant/webhook auth
 * guards.
 */
export function safeTokenEqual(provided: string, expected: string): boolean {
  return safeEqual(sha256hex(provided), sha256hex(expected));
}

/**
 * Fail-closed match of a presented shared token (header value) against the expected
 * secret. Returns `true` ONLY if the secret is configured (`expected` non-empty), the
 * header is present, and the values match in constant time. An empty `expected` →
 * `false` (not configured = DENY). Centralizes the copy-pasted
 * `!expected || !token || !safeTokenEqual(String(token), expected)` from auth guards
 * so the security invariant (fail-closed when the secret is absent) can't be forgotten
 * in one of the places. See admin/tenant/webhook auth guards.
 */
export function matchSharedToken(
  provided: string | string[] | undefined,
  expected: string | undefined,
): boolean {
  return !!expected && !!provided && safeTokenEqual(String(provided), expected);
}
