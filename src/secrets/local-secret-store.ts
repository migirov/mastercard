import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  MerchantSecretBundle,
  SecretStore,
} from './secret-store.types';

/**
 * Дев-реализация хранилища секретов. Источник (по приоритету):
 *   1) файл secrets.local.json в корне проекта (gitignored), карта secretRef → bundle;
 *   2) встроенный демо-сид для sandbox, переиспользующий платформенные ключи
 *      из .env — чтобы прогнать OWN-путь end-to-end без второго онбординга.
 *
 * В проде заменяется на VaultSecretStore (та же сигнатура).
 */
@Injectable()
export class LocalSecretStore implements SecretStore {
  private readonly logger = new Logger(LocalSecretStore.name);
  private cache?: Record<string, MerchantSecretBundle>;

  constructor(private readonly config: ConfigService) {}

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
    const isProd =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production';

    // Демо-сид (ТОЛЬКО не в production): OWN-тенант в sandbox переиспользует
    // платформенные ключи из .env. В проде это утечка ключей платформы OWN-
    // тенанту, поэтому сид отключён — секреты должны приходить из Vault/файла.
    const consumerKey = this.config.get<string>('MC_CONSUMER_KEY');
    const partnerId = this.config.get<string>('MC_PARTNER_ID');
    const p12Path = this.config.get<string>('MC_SIGNING_KEY_PATH');
    const p12Password = this.config.get<string>('MC_SIGNING_KEY_PASSWORD');
    if (!isProd && consumerKey && partnerId && p12Path && p12Password) {
      seed['mc/tenants/own-sandbox'] = {
        consumerKey,
        partnerId,
        signing: { p12Path, password: p12Password },
        encryptionFingerprint: this.config.get<string>(
          'MC_ENCRYPTION_FINGERPRINT',
        ),
      };
    } else if (isProd) {
      this.logger.warn(
        'production + LocalSecretStore: демо-сид отключён. ' +
          'Используйте VaultSecretStore (MC_SECRET_STORE=vault).',
      );
    }

    // Файл secrets.local.json переопределяет/дополняет сид.
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
