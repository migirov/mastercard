import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import * as fs from 'fs';
import * as path from 'path';
import { MerchantSecretBundle, SecretStore } from '../secret-store.types';

/**
 * Dev implementation of the secret store. Sources (by priority):
 *   1) secrets.local.json file in the project root (gitignored), a secretRef → bundle map;
 *   2) built-in demo seed for sandbox that reuses the platform keys
 *      from .env — to run the OWN path end-to-end without a second onboarding.
 *
 * In prod it is replaced by VaultSecretStore (same signature).
 */
@Injectable()
export class LocalSecretStore implements SecretStore {
  private readonly logger = new Logger(LocalSecretStore.name);
  private cache?: Record<string, MerchantSecretBundle>;

  constructor(private readonly config: GatewayConfig) {}

  async getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle> {
    const all = this.load();
    const bundle = all[secretRef];
    if (!bundle) {
      throw new NotFoundException(
        `Secrets '${secretRef}' not found in LocalSecretStore`,
      );
    }
    return bundle;
  }

  private load(): Record<string, MerchantSecretBundle> {
    if (this.cache) return this.cache;

    const seed: Record<string, MerchantSecretBundle> = {};
    const isProd = this.config.isProduction;

    // Demo seed (ONLY outside production): the OWN tenant in sandbox reuses
    // the platform keys. In prod this would leak platform keys to the OWN tenant,
    // so the seed is disabled — secrets must come from Vault/file.
    const consumerKey = this.config.consumerKey;
    const partnerId = this.config.partnerId;
    const p12Path = this.config.signingKeyPath;
    const p12Password = this.config.signingKeyPassword;
    if (!isProd && consumerKey && partnerId && p12Path && p12Password) {
      seed['mc/tenants/own-sandbox'] = {
        consumerKey,
        partnerId,
        signing: { p12Path, password: p12Password },
        encryptionFingerprint: this.config.encryptionFingerprint,
      };
    } else if (isProd) {
      this.logger.warn(
        'production + LocalSecretStore: демо-сид отключён. ' +
          'Используйте VaultSecretStore (MC_SECRET_STORE=vault).',
      );
    }

    // The secrets.local.json file overrides/extends the seed.
    const file = path.resolve(process.cwd(), 'secrets.local.json');
    if (fs.existsSync(file)) {
      try {
        const fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
        Object.assign(seed, fromFile);
        this.logger.log('Секреты подгружены из secrets.local.json');
      } catch (e) {
        throw new Error(
          `Failed to parse secrets.local.json: ${(e as Error).message}`,
        );
      }
    }

    this.cache = seed;
    this.logger.log(
      `LocalSecretStore готов, записей: ${Object.keys(seed).length}`,
    );
    return seed;
  }
}
