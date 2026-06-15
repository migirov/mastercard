/** DI-токен для подключаемой реализации хранилища секретов. */
export const SECRET_STORE = Symbol('SECRET_STORE');

/** Материал ключа .p12 — либо путь (dev), либо base64 (Vault). */
export interface KeyMaterial {
  readonly p12Base64?: string;
  readonly p12Path?: string;
  readonly password: string;
}

/** Полный набор секретов мерчанта, выдаваемый хранилищем по secretRef. */
export interface MerchantSecretBundle {
  readonly consumerKey: string;
  readonly partnerId: string;
  readonly signing: KeyMaterial;
  /** Для JWE-шифрования запросов (Фаза 4). */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** Для расшифровки ответов (Фаза 4). */
  readonly decryption?: KeyMaterial;
}

/**
 * Абстракция секрет-менеджера. Реализации: LocalSecretStore (dev),
 * VaultSecretStore (прод — Vault/AWS/GCP, подключается после выбора вендора).
 */
export interface SecretStore {
  getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle>;
}
