import { Injectable, NotImplementedException } from '@nestjs/common';
import { MerchantSecretBundle, SecretStore } from '../secret-store.types';

/**
 * Прод-реализация секрет-менеджера. Заглушка до выбора вендора
 * (HashiCorp Vault / AWS Secrets Manager / GCP Secret Manager).
 *
 * Контракт: по secretRef вернуть MerchantSecretBundle (ключи лучше хранить
 * как p12Base64). Кэш уже есть на стороне OwnCredentialsProvider/OwnCredentialsCache;
 * здесь — только обращение к вендору + поддержка ротации.
 */
@Injectable()
export class VaultSecretStore implements SecretStore {
  async getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle> {
    throw new NotImplementedException(
      `VaultSecretStore is not configured: choose a secret-manager vendor ` +
        `and implement reading '${secretRef}'.`,
    );
  }
}
