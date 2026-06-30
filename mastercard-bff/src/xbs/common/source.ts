/**
 * Provenance of an XBS response. EVERY cross-border response carries it so the
 * frontend (and a human watching the demo) can tell a real Mastercard answer from a
 * synthesized one:
 *  - `live` — the gateway (and thus Mastercard) actually answered;
 *  - `demo` — synthesized locally (either the capability is in demo mode, or a live
 *    call failed and we gracefully fell back).
 */
export type Source = 'live' | 'demo';
