/**
 * Single predicate for a "weak" secret used by prod gates. Used in TWO places
 * (dev harness `main.ts:assertProdSecrets` reads `process.env`; the embeddable
 * `GatewayConfig` reads typed options) — keep the definition in one place so the
 * thresholds don't drift apart on edits.
 *
 * Weak = empty, shorter than 24 chars, contains `change-me`, or starts with `dev-`.
 */
export const isWeakSecret = (v?: string): boolean =>
  !v || v.length < 24 || v.includes('change-me') || v.startsWith('dev-');
