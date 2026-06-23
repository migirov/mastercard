import { Injectable, NotImplementedException } from '@nestjs/common';
import { MerchantSecretBundle, SecretStore } from '../secret-store.types';

/**
 * Prod implementation of the secret manager. A stub until a vendor is chosen
 * (HashiCorp Vault / AWS Secrets Manager / GCP Secret Manager).
 *
 * Contract: given a secretRef, return a MerchantSecretBundle (keys are best
 * stored as p12Base64). Caching already exists on the
 * OwnCredentialsProvider/OwnCredentialsCache side; here it is only the vendor
 * call plus rotation support.
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
