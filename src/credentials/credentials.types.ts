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
  /** For JWE encryption of requests (Phase 4). */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** For decryption of responses (Phase 4). */
  readonly decryptionKeyPem?: string;
}
