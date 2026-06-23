/**
 * Anti-injection primitives for untrusted strings. The two operations are
 * DELIBERATELY different and NOT interchangeable — hence named by their point of use
 * rather than merged into one "universal" function:
 *  • `stripCrlf` — for an HTTP HEADER value (CR/LF stripped entirely);
 *  • `clipForLog` — for a LOG string (CR/LF → space + length truncation).
 * Applied at the POINT of use (defense-in-depth, not relying on source validation):
 * if the source validator is ever loosened, the header/log are unaffected.
 */

/**
 * HTTP header value with CR/LF removed — protection against header injection. Strips
 * CR/LF entirely (a header must not contain line breaks). See the outgoing MC headers
 * `Partner-Ref-Id` / `partner-id`.
 */
export function stripCrlf(v: string): string {
  return v.replace(/[\r\n]/g, '');
}

/**
 * Sanitizes a value for a LOG line: CR/LF → space (protection against log injection —
 * forging log lines) + length truncation (protection against log bloat).
 * `null`/`undefined` → `'none'`. Defaults to a maximum of 80 chars.
 */
export function clipForLog(v: string | null | undefined, max = 80): string {
  if (v == null) return 'none';
  return v.replace(/[\r\n]/g, ' ').slice(0, max);
}
