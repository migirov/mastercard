/**
 * Разрешённые credentials Mastercard для конкретного мерчанта.
 * Остальной код работает только с этим типом и не знает, общие это ключи
 * платформы или собственные ключи мерчанта.
 */
export interface McCredentials {
  consumerKey: string;
  /** Приватный ключ подписи в формате PEM. */
  signingKeyPem: string;
  partnerId: string;
  /** Для JWE-шифрования запросов (Фаза 4). */
  encryptionCertPem?: string;
  encryptionFingerprint?: string;
  /** Для расшифровки ответов (Фаза 4). */
  decryptionKeyPem?: string;
}
