/**
 * Разрешённые credentials Mastercard для конкретного мерчанта.
 * Остальной код работает только с этим типом и не знает, общие это ключи
 * платформы или собственные ключи мерчанта.
 */
export interface McCredentials {
  readonly consumerKey: string;
  /** Приватный ключ подписи в формате PEM. */
  readonly signingKeyPem: string;
  readonly partnerId: string;
  /** Для JWE-шифрования запросов (Фаза 4). */
  readonly encryptionCertPem?: string;
  readonly encryptionFingerprint?: string;
  /** Для расшифровки ответов (Фаза 4). */
  readonly decryptionKeyPem?: string;
}
