/**
 * Deterministic JSON serialization: object keys are emitted in sorted order at every
 * depth, so two semantically identical objects whose keys differ only in insertion
 * order serialize to the SAME string. Arrays keep their order (element order is
 * meaningful). Primitives, `null`, and nested structures are handled recursively.
 *
 * Use this for CONTENT FINGERPRINTS — e.g. the payment idempotency body hash — where a
 * key-reordered but otherwise identical body MUST hash the same: a client SDK, proxy, or
 * JSON round-trip that re-serializes a retry can legitimately reorder keys, and a raw
 * `JSON.stringify` (which preserves insertion order) would then mistake an identical
 * payment for a different one and reject the safe retry as "different body".
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}
