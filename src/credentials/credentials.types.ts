/**
 * Resolved Mastercard credentials for a specific merchant.
 * The rest of the code works only with this type and does not know whether
 * these are shared platform keys or the merchant's own keys.
 */
export interface McCredentials {
  readonly consumerKey: string;
  /** Private signing key in PEM format. */
  readonly signingKeyPem: string;
  readonly partnerId: string;
  /** Public cert for field-level (JWE) encryption of requests. */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** Private key for decryption of responses. */
  readonly decryptionKeyPem?: string;
}
