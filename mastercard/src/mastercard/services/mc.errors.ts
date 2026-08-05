/**
 * Deterministic errors from the outbound pipeline (auth-header construction, request
 * encryption, response decryption). The `MastercardClient` retry loop does NOT retry
 * these: a repeat yields the same result plus extra round-trips to MC — they surface
 * as a 502 higher up (in CrossBorderGateway). Shared by the axios interceptors (which
 * throw them) and the retry loop (which detects them).
 */
export class NonRetryableMcError extends Error {
  /**
   * Whether the request reached Mastercard before this error was raised.
   *
   * This drives the payment idempotency slot: a failure raised BEFORE anything went
   * on the wire is provably not executed, so the slot must be RELEASED — otherwise a
   * merchant retrying the same `transaction_reference` gets a 409 for a payment that
   * was never attempted. A failure after the send (e.g. response decryption) leaves
   * the outcome unknown and the slot must be HELD.
   */
  readonly sent: boolean = true;

  /**
   * The underlying failure, when this error wraps one. Assigned rather than passed to
   * `super(msg, { cause })`: the package targets ES2021, where `ErrorOptions` does not
   * exist yet. Without it the only surviving stack points at the wrapper.
   */
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Request encryption/preparation error (e.g. the per-tenant fail-loud guard).
 * Raised in the request interceptor, so nothing was transmitted.
 */
export class RequestEncryptError extends NonRetryableMcError {
  override readonly sent = false;
}

/**
 * MC response decryption error (raised in the response interceptor). The request DID
 * reach Mastercard and may well have been executed — the outcome is unknown.
 */
export class ResponseDecryptError extends NonRetryableMcError {
  override readonly sent = true;
}

/**
 * The auth strategy failed or overran its budget while building the request's
 * authentication headers. Raised in the request interceptor, before the adapter runs,
 * so nothing was transmitted.
 */
export class AuthHeaderError extends NonRetryableMcError {
  override readonly sent = false;
}

/**
 * Which side of the handshake is at fault. The two are fixed in completely different
 * places, and telling them apart is the entire point of this taxonomy — on MTF, where
 * mTLS first becomes mandatory, "Mastercard is down" and "our certificate is wrong"
 * are otherwise the same opaque 502.
 */
export type TlsHandshakeReason =
  /** Mastercard refused the client certificate we presented (or we presented none). */
  | 'client-certificate'
  /** We could not verify Mastercard's server certificate. */
  | 'server-certificate'
  /** TLS negotiation failed for some other deterministic reason. */
  | 'handshake';

/**
 * The TLS handshake with Mastercard failed.
 *
 * Non-retryable on purpose: every code below is a configuration fact, not a blip, so
 * a retry burns two more round-trips and delays the 502 by the backoff. `ECONNRESET`,
 * `ETIMEDOUT` and friends are deliberately NOT classified here — those are genuinely
 * transient and must keep retrying on idempotent GETs.
 */
export class TlsHandshakeError extends NonRetryableMcError {
  /**
   * The handshake never completed, so not one byte of the request was transmitted.
   * That releases the payment idempotency slot instead of holding it for the full
   * lock TTL over a failure that provably did not reach Mastercard.
   */
  override readonly sent = false;

  constructor(
    message: string,
    readonly reason: TlsHandshakeReason,
    /** The Node/OpenSSL error code this was classified from. */
    readonly code: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/**
 * OpenSSL verification codes raised by US, while checking MASTERCARD'S server
 * certificate. Fixed with MC_MTLS_CA_PATH (or by fixing the host's trust store) —
 * never by touching our own client certificate.
 */
const SERVER_CERT_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_UNTRUSTED',
  'CERT_SIGNATURE_FAILURE',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_REVOKED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/**
 * TLS alerts RECEIVED from Mastercard about the certificate we presented (or failed
 * to present). Node surfaces a received alert as `ERR_SSL_<alert>`; a rejection we
 * ourselves raise surfaces as one of the SERVER_CERT_CODES above, which is what makes
 * the two buckets separable at all.
 */
const CLIENT_CERT_ALERT_CODES = new Set([
  'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
  'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA',
  'ERR_SSL_TLSV1_ALERT_ACCESS_DENIED',
  'ERR_SSL_TLSV1_ALERT_DECRYPT_ERROR',
  'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE',
  'ERR_SSL_SSLV3_ALERT_UNSUPPORTED_CERTIFICATE',
  'ERR_SSL_SSLV3_ALERT_CERTIFICATE_REVOKED',
  'ERR_SSL_SSLV3_ALERT_CERTIFICATE_EXPIRED',
  'ERR_SSL_SSLV3_ALERT_CERTIFICATE_UNKNOWN',
  'ERR_SSL_SSLV3_ALERT_NO_CERTIFICATE',
]);

/**
 * Message signatures, for the failures Node reports with no usable `code`. Verified
 * against Node v20.20.2 — the code alone is NOT enough, in two distinct ways:
 *
 *  - the SAME rejection reports differently per protocol version. A server refusing
 *    our (absent) client certificate yields `ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED`
 *    under TLS 1.3 but a bare `EPROTO` under TLS 1.2, with the alert only in the text.
 *    `EPROTO` is indistinguishable from a transient socket error by code, so without
 *    this table a TLS 1.2 edge would retry a rejected certificate three times and then
 *    report "Mastercard unreachable".
 *  - an unopenable keystore (wrong password on a tenant's mTLS material, resolved from
 *    the SecretStore at request time) throws SYNCHRONOUSLY out of `createSecureContext`
 *    with no `code` property at all — only `mac verify failure`.
 *
 * Each string is specific enough that it cannot match an ordinary network error.
 */
const MESSAGE_SIGNATURES: ReadonlyArray<readonly [string, TlsHandshakeReason]> =
  [
    ['alert certificate required', 'client-certificate'],
    ['alert handshake failure', 'client-certificate'],
    ['alert unknown ca', 'client-certificate'],
    ['alert bad certificate', 'client-certificate'],
    ['alert unsupported certificate', 'client-certificate'],
    ['alert certificate revoked', 'client-certificate'],
    ['alert certificate expired', 'client-certificate'],
    ['alert certificate unknown', 'client-certificate'],
    ['alert access denied', 'client-certificate'],
    ['alert decrypt error', 'client-certificate'],
    ['peer did not return a certificate', 'client-certificate'],
    // Our own keystore could not be opened — same fix as a rejected certificate.
    ['mac verify failure', 'client-certificate'],
    ['unable to verify the first certificate', 'server-certificate'],
    ['self-signed certificate', 'server-certificate'],
    ['certificate has expired', 'server-certificate'],
  ];

function reasonFor(code: string): TlsHandshakeReason | undefined {
  if (SERVER_CERT_CODES.has(code)) return 'server-certificate';
  if (CLIENT_CERT_ALERT_CODES.has(code)) return 'client-certificate';
  // Our own key material failed to load — a wrong MC_MTLS_CLIENT_CERT_PASSWORD
  // surfaces as ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE, an unsupported cipher in the
  // keystore as another ERR_OSSL_*. Same fix, same bucket.
  if (code.startsWith('ERR_OSSL_')) return 'client-certificate';
  // Any other OpenSSL-level negotiation failure (wrong port, protocol mismatch,
  // an alert this list does not name yet). Still deterministic, still not sent.
  if (code.startsWith('ERR_SSL_')) return 'handshake';
  return undefined;
}

const ADVICE: Record<TlsHandshakeReason, string> = {
  'client-certificate':
    'Mastercard rejected the client certificate we presented (or none was presented). ' +
    'Check MC_MTLS_ENABLED, MC_MTLS_CLIENT_CERT_PATH and MC_MTLS_CLIENT_CERT_PASSWORD, ' +
    'and that the certificate is the one issued for this edge through the Key Management Portal.',
  'server-certificate':
    "Could not verify Mastercard's server certificate. Check the host trust store, " +
    'or set MC_MTLS_CA_PATH if Mastercard supplied a private CA chain for this edge.',
  handshake: 'TLS negotiation failed before any request data was sent.',
};

/**
 * Classifies a transport failure as a TLS handshake problem, or returns `undefined`
 * to leave it alone. Pure — the retry loop calls it and rethrows the result.
 *
 * Both `error.code` and `error.cause.code` are inspected: axios copies the socket's
 * code onto the AxiosError, but it also has cases where it substitutes its own
 * (`ERR_BAD_REQUEST` and the like) and keeps the original only under `cause`. When
 * neither code is conclusive the message is consulted — see MESSAGE_SIGNATURES for
 * why that is necessary rather than belt-and-braces.
 *
 * Deliberately conservative: anything unrecognised falls through to the retry path,
 * because wrongly marking a transient blip non-retryable fails a call that would
 * have succeeded on the second attempt.
 */
export function asTlsHandshakeError(
  e: unknown,
  host: string,
): TlsHandshakeError | undefined {
  if (e instanceof TlsHandshakeError) return e;
  const err = e as {
    code?: unknown;
    message?: unknown;
    cause?: { code?: unknown; message?: unknown };
  };
  const build = (reason: TlsHandshakeReason, code: string) =>
    new TlsHandshakeError(
      // The verdict goes in the TEXT, not just the field: the gateway logs
      // `e.message` and nothing else, and `[client-certificate]` is what an operator
      // greps for. DEPLOY.md documents the three values.
      `TLS handshake with ${host} failed [${reason}] (${code}). ${ADVICE[reason]}`,
      reason,
      code,
      e,
    );

  const codes = [err?.code, err?.cause?.code].filter(
    (c): c is string => typeof c === 'string',
  );
  for (const code of codes) {
    const reason = reasonFor(code);
    if (reason) return build(reason, code);
  }

  const text = [err?.message, err?.cause?.message]
    .filter((m): m is string => typeof m === 'string')
    .join(' ')
    .toLowerCase();
  for (const [signature, reason] of MESSAGE_SIGNATURES) {
    if (text.includes(signature)) return build(reason, codes[0] ?? signature);
  }
  return undefined;
}
