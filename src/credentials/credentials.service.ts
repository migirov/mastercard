import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loadPrivateKeyFromP12,
  loadPrivateKeyFromP12Base64,
} from '../common/p12.util';
import { CredentialMode, Tenant } from '../tenants/tenant.types';
import {
  KeyMaterial,
  MerchantSecretBundle,
  SECRET_STORE,
  SecretStore,
} from '../secrets/secret-store.types';
import { McCredentials } from './credentials.types';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
/** Символы, которые ломают URL-путь — partnerId с ними запрещён (+ `\`). */
const UNSAFE_PARTNER_ID = /[\s/\\?#%]/;

interface CacheEntry {
  /** Кэшируем сам Promise: одновременные запросы переиспользуют один резолв. */
  promise: Promise<McCredentials>;
  expiresAt: number;
}

/**
 * Резолвер credentials. Единый интерфейс над двумя режимами:
 *   PLATFORM — общие ключи платформы из конфигурации (кэш без TTL: ротация
 *              через рестарт, т.к. это инфраструктурный секрет);
 *   OWN      — собственные ключи мерчанта из SecretStore (Vault/KMS), кэш с TTL.
 */
@Injectable()
export class CredentialsService implements OnModuleInit {
  private readonly logger = new Logger(CredentialsService.name);
  private platformCache?: McCredentials;
  private readonly ownCache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(
    private readonly config: ConfigService,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
  ) {
    this.ttlMs =
      Number(this.config.get<string>('MC_CREDS_CACHE_TTL_MS')) || DEFAULT_TTL_MS;
  }

  /** Прогреваем платформенные credentials на старте: fail-fast (кривой .p12/
   *  пароль валит boot, а не первый запрос) + первый PLATFORM-запрос не ждёт парс. */
  onModuleInit(): void {
    this.platformCredentials();
  }

  async resolve(tenant: Tenant): Promise<McCredentials> {
    switch (tenant.credentialMode) {
      case CredentialMode.PLATFORM:
        return this.platformCredentials();
      case CredentialMode.OWN:
        return this.ownCredentials(tenant);
      default:
        throw new Error(`Unknown credentialMode for tenant '${tenant.id}'`);
    }
  }

  /** Сброс кэша credentials мерчанта (для ротации ключей). */
  invalidate(tenantId: string): void {
    this.ownCache.delete(tenantId);
  }

  // --- PLATFORM ---

  private platformCredentials(): McCredentials {
    if (this.platformCache) return this.platformCache;

    const signingKeyPem = loadPrivateKeyFromP12(
      this.req('MC_SIGNING_KEY_PATH'),
      this.req('MC_SIGNING_KEY_PASSWORD'),
    );
    this.platformCache = {
      consumerKey: this.req('MC_CONSUMER_KEY'),
      signingKeyPem,
      partnerId: this.safePartnerId(this.req('MC_PARTNER_ID'), 'platform'),
      encryptionFingerprint: this.config.get<string>('MC_ENCRYPTION_FINGERPRINT'),
    };
    this.logger.log('Платформенные credentials загружены и закэшированы');
    return this.platformCache;
  }

  // --- OWN ---

  private ownCredentials(tenant: Tenant): Promise<McCredentials> {
    const cached = this.ownCache.get(tenant.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    // Дедупликация stampede: первый запрос запускает резолв, остальные ждут
    // тот же Promise. Отклонённый промис выселяем, чтобы сбой не залип на TTL.
    const promise = this.fetchOwn(tenant);
    const entry: CacheEntry = { promise, expiresAt: Date.now() + this.ttlMs };
    this.ownCache.set(tenant.id, entry);
    promise.catch(() => {
      if (this.ownCache.get(tenant.id) === entry) {
        this.ownCache.delete(tenant.id);
      }
    });
    return promise;
  }

  private async fetchOwn(tenant: Tenant): Promise<McCredentials> {
    if (!tenant.secretRef) {
      throw new Error(`Tenant '${tenant.id}' (OWN) has no secretRef`);
    }

    const bundle = await this.secrets.getMerchantSecrets(tenant.secretRef);
    this.validateBundle(tenant.secretRef, bundle);

    const creds: McCredentials = {
      consumerKey: bundle.consumerKey,
      // приоритет у явного partnerId тенанта, иначе из бандла
      partnerId: this.safePartnerId(
        tenant.partnerId ?? bundle.partnerId,
        tenant.id,
      ),
      signingKeyPem: this.toPem(bundle.signing),
      encryptionCertPem: bundle.encryptionCertPem,
      encryptionFingerprint: bundle.encryptionFingerprint,
      decryptionKeyPem: bundle.decryption
        ? this.toPem(bundle.decryption)
        : undefined,
    };

    this.logger.log(`OWN credentials для tenant '${tenant.id}' закэшированы`);
    return creds;
  }

  // --- helpers ---

  /** Валидация границы секретов: бандл должен содержать минимум для подписи. */
  private validateBundle(ref: string, b: MerchantSecretBundle): void {
    if (!b.consumerKey) {
      throw new Error(`SecretStore '${ref}': missing consumerKey`);
    }
    if (!b.signing) {
      throw new Error(`SecretStore '${ref}': missing signing key material`);
    }
  }

  /** Проверяет, что partnerId задан и не ломает URL-путь. */
  private safePartnerId(id: string | undefined, tenantId: string): string {
    if (!id) {
      throw new Error(`tenant '${tenantId}': partnerId is not set`);
    }
    // `..` отдельно — иначе path-traversal в пути MC (.../partners/../crossborder).
    if (UNSAFE_PARTNER_ID.test(id) || id.includes('..')) {
      throw new Error(`tenant '${tenantId}': invalid partnerId`);
    }
    return id;
  }

  /** Нормализует материал ключа (path | base64) в PEM. */
  private toPem(key: KeyMaterial): string {
    if (key.p12Base64) {
      return loadPrivateKeyFromP12Base64(key.p12Base64, key.password);
    }
    if (key.p12Path) {
      return loadPrivateKeyFromP12(key.p12Path, key.password);
    }
    throw new Error('KeyMaterial: neither p12Base64 nor p12Path is set');
  }

  private req(name: string): string {
    const v = this.config.get<string>(name);
    if (!v) {
      throw new Error(`Environment variable ${name} is not set`);
    }
    return v;
  }
}
