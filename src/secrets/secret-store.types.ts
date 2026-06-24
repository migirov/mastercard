/** DI token for the pluggable secret store implementation. */
export const SECRET_STORE = Symbol('SECRET_STORE');

/** .p12 key material — either a path (dev) or base64 (AWS Secrets Manager). */
export interface KeyMaterial {
  readonly p12Base64?: string;
  readonly p12Path?: string;
  readonly password: string;
}

/** Full set of merchant secrets returned by the store for a given secretRef. */
export interface MerchantSecretBundle {
  readonly consumerKey: string;
  readonly partnerId: string;
  readonly signing: KeyMaterial;
  /** For JWE encryption of requests (Phase 4). */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** For decryption of responses (Phase 4). */
  readonly decryption?: KeyMaterial;
}

/**
 * Secret manager abstraction. Implementations: LocalSecretStore (dev),
 * AwsSecretsManagerSecretStore (prod — AWS Secrets Manager).
 */
export interface SecretStore {
  getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle>;
}
