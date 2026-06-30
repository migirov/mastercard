/**
 * Defensive accessors for the OPAQUE Mastercard JSON the gateway returns. The exact
 * field names vary by API area / version, so live-mode parsing tries several likely
 * paths and tolerates anything missing (returning undefined) rather than throwing —
 * a parse miss flows up as a graceful fall back to demo synthesis.
 */

/** Safely read a nested path (e.g. `pick(obj, 'a', 'b', 'c')`). */
export function pick(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** First defined value among several candidate paths. */
export function firstDefined(obj: unknown, paths: string[][]): unknown {
  for (const p of paths) {
    const v = pick(obj, ...p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/** Coerce a value (string or number) to a finite number, else undefined. */
export function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Coerce to a non-empty string, else undefined. */
export function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim() !== '') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Round a money/rate value to 4 dp (enough for display; avoids float noise). */
export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
