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
 *
 * Accepts `unknown`, not `string`: its callers include the webhook handler, which logs
 * fields that are NOT declared in the DTO and therefore survive the Passthrough pipe with
 * whatever JSON type the sender chose. Typing this as `string` made that a compile-time
 * fiction — a numeric `status` reached `.replace` and threw, turning an endpoint documented
 * as always-200 into a 500. Coercing here keeps the guarantee at the one place that can.
 */
export function clipForLog(v: unknown, max = 80): string {
  if (v == null) return 'none';
  const s = typeof v === 'string' ? v : safeStringify(v);
  return s.replace(/[\r\n]/g, ' ').slice(0, max);
}

/** Objects/arrays as compact JSON; anything unserializable falls back to its type name. */
function safeStringify(v: unknown): string {
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v) ?? String(v);
    } catch {
      return '[unserializable]';
    }
  }
  return String(v);
}
