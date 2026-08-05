/**
 * Resolved Mastercard credentials for a specific merchant.
 * The rest of the code works only with this type and does not know whether
 * these are shared platform keys or the merchant's own keys.
 */
/**
 * Client-certificate material for outbound mTLS to Mastercard (KMP-issued, one per
 * partner). The raw PKCS#12 is handed to Node untouched so the FULL chain in it is
 * presented — re-encoding through PEM would drop the intermediates and produce an
 * "unknown CA" rejection that only shows up in production.
 */
export interface McMtlsMaterial {
  readonly pfx: Buffer;
  readonly passphrase: string;
  /** base64url(SHA-256(DER)) of the client cert — the agent-cache key. */
  readonly thumbprintS256: string;
  readonly notAfter?: Date;
}

export interface McCredentials {
  readonly consumerKey: string;
  /** Private signing key in PEM format. */
  readonly signingKeyPem: string;
  readonly partnerId: string;
  /**
   * Leaf signing certificate (PEM) paired with `signingKeyPem`. Optional: only the
   * OAuth2 request-token strategy needs it (for the optional JOSE `x5c`), so OAuth1
   * deployments and test fixtures may omit it.
   */
  readonly signingCertPem?: string;
  /**
   * base64url(SHA-256(DER)) of the signing certificate — the JOSE `x5t#S256` of the
   * OAuth2 request token. Optional for the same reason as `signingCertPem`.
   * NOT the same thing as `encryptionFingerprint` (that one is 64-hex over a key).
   */
  readonly signingCertThumbprintS256?: string;
  /**
   * The tenant's OWN client certificate for outbound mTLS. Its PRESENCE selects a
   * per-tenant TLS identity over the platform's — the same idiom `encryptionCertPem`
   * uses for JWE keys. Absent = this tenant rides the platform certificate.
   */
  readonly mtls?: McMtlsMaterial;
  /** Public cert for field-level (JWE) encryption of requests. */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** Private key for decryption of responses. */
  readonly decryptionKeyPem?: string;
}
