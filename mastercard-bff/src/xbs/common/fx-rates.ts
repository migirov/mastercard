/**
 * A tiny built-in mid-market rate table for demo synthesis. Plausible, not real —
 * the demo's `live` quote uses Mastercard; this only backs `demo` mode and the
 * live-call graceful fallback. Rates are expressed as 1 BASE = N quote.
 */
const MID: Record<string, Record<string, number>> = {
  USD: { ILS: 3.7, EUR: 1 / 1.08 },
  EUR: { ILS: 4.0, USD: 1.08 },
  ILS: { USD: 1 / 3.7, EUR: 1 / 4.0 },
};

/** Spread applied around the mid-market rate (0.5%). */
export const DEMO_SPREAD_PCT = 0.5;

/**
 * Mid-market rate from `source` to `target`. Same currency → 1.0; a known pair → its
 * table value; the inverse of a known pair → 1 / value; otherwise a benign 1.0 (the
 * demo never errors on an unknown pair, it just quotes parity).
 */
export function midRate(source: string, target: string): number {
  const s = source.toUpperCase();
  const t = target.toUpperCase();
  if (s === t) return 1;
  const direct = MID[s]?.[t];
  if (direct !== undefined) return direct;
  const inverse = MID[t]?.[s];
  if (inverse !== undefined && inverse !== 0) return 1 / inverse;
  return 1;
}
