/**
 * The one TLS floor for this service, stated in one place so the two ends cannot drift apart:
 * the OUTBOUND agent to Mastercard (`MastercardClient`) and the INBOUND listener that
 * terminates Mastercard's mTLS push notifications (`harness/https-options`).
 *
 * Why pin it at all, when Node's own default is already TLSv1.2: that default is
 * PROCESS-GLOBAL and belongs to whoever starts the process. `--tls-min-v1.0` /
 * `--tls-min-v1.1` in `NODE_OPTIONS`, or a stray assignment to `tls.DEFAULT_MIN_VERSION`,
 * would silently drop every Mastercard connection to a deprecated protocol with nothing in
 * this codebase objecting. Stating the floor per-socket makes it a property of this component
 * instead, which neither an operator flag nor an embedding host can reach.
 *
 * This is OUR baseline, not a quoted Mastercard requirement. The Cross-Border specification
 * (`docs/*​/api-mastercard.md`) states no minimum TLS version and no cipher requirement; what it
 * does mandate is mTLS on inbound push notifications. TLSv1.2 is the industry/PCI baseline, and
 * there is deliberately no configuration option to lower it.
 */
export const MIN_TLS_VERSION = 'TLSv1.2' as const;
