import { McCredentials } from '../../credentials/credentials.types';

/**
 * DI token for the active outbound authentication strategy. Mirrors the
 * `SECRET_STORE` token: one symbol, one interface, several implementations, and a
 * `useFactory` in the owning module that picks one from `GatewayConfig`.
 */
export const MC_AUTH_STRATEGY = Symbol('MC_AUTH_STRATEGY');

/**
 * How we authenticate OUTBOUND calls to Mastercard. Not to be confused with the
 * gateway's own inbound OAuth2 server (`/oauth/token`), which authenticates our
 * merchants to us.
 *
 *  - `oauth1`: OAuth 1.0a request signing. Required on `sandbox.api.mastercard.com`
 *    and `api.mastercard.com`.
 *  - `oauth2-request-token`: Mastercard's `OAUTH2_REQUEST_TOKEN` grant — a
 *    self-signed JWT in the `Authorization` header, no token endpoint and no DPoP.
 *    Required on the PSD2 edges `*.api.xbs.mastercard.eu` / `.uk` for customers
 *    contracted with MTS EU / MTS UK.
 */
export type McAuthMode = 'oauth1' | 'oauth2-request-token';

/** The request as it will actually go on the wire — AFTER encryption and serialization. */
export interface McOutboundRequest {
  /** Upper-cased HTTP method. */
  readonly method: string;
  /** Absolute URL, including any query string. */
  readonly url: string;
  /** The final body string, or undefined for bodiless requests. */
  readonly payload?: string;
}

/**
 * Produces the authentication headers for one outbound Mastercard request.
 *
 * Returns a MAP rather than a single header value on purpose: the header name is
 * mode-dependent, and a future scheme may need to set more than one header.
 *
 * Implementations MUST resolve quickly — the interceptor bounds them (see
 * `MC_AUTH_HEADER_BUDGET_MS`) because axios arms the caller's abort signal in the
 * adapter, i.e. AFTER the interceptor chain, so a hanging strategy would not be
 * caught by the per-request timeout. A strategy that performs I/O MUST use its own
 * HTTP client with its own timeout and MUST NOT reuse `MastercardClient`'s axios
 * instance — that one carries the signing and encryption interceptors, so a call
 * through it would recurse.
 */
export interface McAuthStrategy {
  readonly mode: McAuthMode;
  authHeaders(
    creds: McCredentials,
    req: McOutboundRequest,
  ): Promise<Record<string, string>>;
}
