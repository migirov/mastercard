/**
 * Deterministic crypto-pipeline errors (request encryption / response decryption). The
 * `MastercardClient` retry loop does NOT retry these: a repeat yields the same result plus
 * extra signed round-trips to MC — they surface as a 502 higher up (in CrossBorderGateway).
 * Shared by the axios interceptors (which throw them) and the retry loop (which detects them).
 */
export class NonRetryableMcError extends Error {}

/** Request encryption/preparation error (e.g. the per-tenant fail-loud guard). */
export class RequestEncryptError extends NonRetryableMcError {}

/** MC response decryption error (raised in the response interceptor). */
export class ResponseDecryptError extends NonRetryableMcError {}
