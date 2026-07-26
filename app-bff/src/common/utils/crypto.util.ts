import { createHash, timingSafeEqual } from 'crypto';

/**
 * Minimal token-comparison helpers, duplicated from the gateway's
 * `mastercard/src/common/utils/crypto.util.ts`.
 *
 * The duplication is deliberate and unavoidable: `mastercard/` is a separate, unpublished npm
 * project and this service's Dockerfile only copies its own build context, so there is nothing
 * to import. Keep the two in sync by hand — the invariants below are the reason this file
 * exists at all, so do not "simplify" them.
 */

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
 * the length and lets you safely compare inputs of any length.
 */
export function safeTokenEqual(provided: string, expected: string): boolean {
  return safeEqual(sha256hex(provided), sha256hex(expected));
}

/**
 * Fail-closed match of a presented shared token against the expected secret. Returns `true`
 * ONLY if the secret is configured (`expected` non-empty), the header is present, and the
 * values match in constant time. An empty `expected` → `false` (not configured = DENY), so a
 * missing token can never silently turn the API back into an open one.
 */
export function matchSharedToken(
  provided: string | string[] | undefined,
  expected: string | undefined,
): boolean {
  return !!expected && !!provided && safeTokenEqual(String(provided), expected);
}
