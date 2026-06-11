/** DI-токен для подключаемой реализации хранилища секретов. */
export const SECRET_STORE = Symbol('SECRET_STORE');

/** Материал ключа .p12 — либо путь (dev), либо base64 (Vault). */
export interface KeyMaterial {
  p12Base64?: string;
  p12Path?: string;
  password: string;
}

/** Полный набор секретов мерчанта, выдаваемый хранилищем по secretRef. */
export interface MerchantSecretBundle {
  consumerKey: string;
  partnerId: string;
  signing: KeyMaterial;
  /** Для JWE-шифрования запросов (Фаза 4). */
  encryptionCertPem?: string;
  encryptionFingerprint?: string;
  /** Для расшифровки ответов (Фаза 4). */
  decryption?: KeyMaterial;
}

/**
 * Абстракция секрет-менеджера. Реализации: LocalSecretStore (dev),
 * VaultSecretStore (прод — Vault/AWS/GCP, подключается после выбора вендора).
 */
export interface SecretStore {
  getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle>;
}
