import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import {
  loadPrivateKeyFromP12,
  loadPrivateKeyFromP12Base64,
} from '../../common/utils/p12.util';
import { CredentialMode, Tenant } from '../../tenants/tenant.types';
import {
  KeyMaterial,
  MerchantSecretBundle,
  SECRET_STORE,
  SecretStore,
} from '../../secrets/secret-store.types';
import { McCredentials } from '../credentials.types';

// partnerId уходит в URL-путь запроса к MC → строгий АЛЛОУЛИСТ (а не денилист):
// денилист легко пропускает control-байты/`;@:&=`/exotic-unicode. Реальные MC
// partner-id — алфанумерик + `_-.` (напр. SANDBOX_1234567). Применяется и к
// partnerId из бандла SecretStore (он не проходит DTO-валидацию).
const SAFE_PARTNER_ID = /^[A-Za-z0-9._-]{1,64}$/;

// secretRef интерполируется в ключ-путь Vault (когда стор будет подключён) →
// та же защита от traversal/key-confusion на границе (DTO покрывает только
// admin-create; сиды/иные пути конструируют тенанта напрямую). Разрешаем `/`
// (иерархия ключей Vault), но запрещаем `..`-сегменты (проверяется отдельно).
const SAFE_SECRET_REF = /^[A-Za-z0-9._/-]{1,256}$/;

interface CacheEntry {
  /** Кэшируем сам Promise: одновременные запросы переиспользуют один резолв. */
  promise: Promise<McCredentials>;
  expiresAt: number;
}

/**
 * Жёсткий потолок числа OWN-записей в кэше (в дополнение к TTL): без него большой
 * легитимный набор OWN-партнёров (или будущий bulk-онбординг) рос бы неограниченно
 * на каждом поде, удерживая полный материал ключей. При переполнении выселяем
 * least-recently-used.
 */
const OWN_CACHE_MAX = 500;

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
    private readonly config: GatewayConfig,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
  ) {
    this.ttlMs = this.config.credsCacheTtlMs;
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
      this.config.require('signingKeyPath'),
      this.config.require('signingKeyPassword'),
    );
    this.platformCache = {
      consumerKey: this.config.require('consumerKey'),
      signingKeyPem,
      partnerId: this.safePartnerId(
        this.config.require('partnerId'),
        'platform',
      ),
      encryptionFingerprint: this.config.encryptionFingerprint,
    };
    this.logger.log('Платформенные credentials загружены и закэшированы');
    return this.platformCache;
  }

  // --- OWN ---

  private ownCredentials(tenant: Tenant): Promise<McCredentials> {
    const now = Date.now();
    const cached = this.ownCache.get(tenant.id);
    if (cached && cached.expiresAt > now) {
      // recency для LRU: переставляем в конец (most-recently-used), TTL не трогаем.
      this.ownCache.delete(tenant.id);
      this.ownCache.set(tenant.id, cached);
      return cached.promise;
    }

    // На cache-miss подметаем протухшие записи: иначе кэш рос бы по числу ВСЕХ
    // когда-либо резолвленных тенантов (удерживая их PEM-ключи), а не по активному
    // набору. Карта мала (≈ число OWN-партнёров) → O(n) приемлемо, таймер не нужен.
    for (const [id, e] of this.ownCache) {
      if (e.expiresAt <= now) this.ownCache.delete(id);
    }

    // Дедупликация stampede: первый запрос запускает резолв, остальные ждут
    // тот же Promise. Отклонённый промис выселяем, чтобы сбой не залип на TTL.
    const promise = this.fetchOwn(tenant);
    const entry: CacheEntry = { promise, expiresAt: Date.now() + this.ttlMs };
    this.ownCache.set(tenant.id, entry);
    // Жёсткий потолок (LRU): после вставки выселяем самые старые сверх лимита.
    while (this.ownCache.size > OWN_CACHE_MAX) {
      const oldest = this.ownCache.keys().next().value as string | undefined;
      if (oldest === undefined || oldest === tenant.id) break;
      this.ownCache.delete(oldest);
    }
    promise.catch(() => {
      if (this.ownCache.get(tenant.id) === entry) {
        this.ownCache.delete(tenant.id);
      }
    });
    return promise;
  }

  private async fetchOwn(tenant: Tenant): Promise<McCredentials> {
    if (!tenant.secretRef) {
      // Конфиг тенанта неполон — это не краш сервера (500), а «тенант не
      // сконфигурирован» → 422. Детали (id) в лог, наружу — без них.
      this.logger.error(`Tenant '${tenant.id}' (OWN) has no secretRef`);
      throw new UnprocessableEntityException(
        'tenant credentials are not configured',
      );
    }
    const secretRef = this.safeSecretRef(tenant.secretRef, tenant.id);

    const bundle = await this.secrets.getMerchantSecrets(secretRef);
    this.validateBundle(secretRef, bundle);

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

  // Провалы резолва credentials — это «тенант не сконфигурирован», а НЕ краш
  // сервера: бросаем UnprocessableEntity (422), а не сырой Error (→ 500 + паника
  // алертинга). Чувствительные детали (secretRef) — только в лог, не в ответ.

  /** Валидация границы секретов: бандл должен содержать минимум для подписи. */
  private validateBundle(ref: string, b: MerchantSecretBundle): void {
    if (!b.consumerKey) {
      this.logger.error(`SecretStore '${ref}': missing consumerKey`);
      throw new UnprocessableEntityException(
        'credentials bundle is missing consumerKey',
      );
    }
    if (!b.signing) {
      this.logger.error(`SecretStore '${ref}': missing signing key material`);
      throw new UnprocessableEntityException(
        'credentials bundle is missing signing key material',
      );
    }
  }

  /** Проверяет, что partnerId задан и безопасен для URL-пути (строгий аллоулист). */
  private safePartnerId(id: string | undefined, tenantId: string): string {
    if (!id) {
      this.logger.error(`tenant '${tenantId}': partnerId is not set`);
      throw new UnprocessableEntityException('partnerId is not set');
    }
    // Аллоулист уже исключает `/` → `..`-сегмент невозможен; проверяем явно лишь
    // на случай, если charset когда-то расширят.
    if (!SAFE_PARTNER_ID.test(id) || id.includes('..')) {
      this.logger.error(`tenant '${tenantId}': invalid partnerId`);
      throw new UnprocessableEntityException('invalid partnerId');
    }
    return id;
  }

  /** Проверяет, что secretRef безопасен как ключ-путь секрет-стора (анти-traversal). */
  private safeSecretRef(ref: string, tenantId: string): string {
    if (!SAFE_SECRET_REF.test(ref) || ref.includes('..')) {
      this.logger.error(`tenant '${tenantId}': invalid secretRef`);
      throw new UnprocessableEntityException('invalid secretRef');
    }
    return ref;
  }

  /** Нормализует материал ключа (path | base64) в PEM. */
  private toPem(key: KeyMaterial): string {
    if (key.p12Base64) {
      return loadPrivateKeyFromP12Base64(key.p12Base64, key.password);
    }
    if (key.p12Path) {
      return loadPrivateKeyFromP12(key.p12Path, key.password);
    }
    throw new UnprocessableEntityException('invalid key material');
  }
}
