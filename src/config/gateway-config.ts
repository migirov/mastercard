import { Injectable } from '@nestjs/common';
import { isWeakSecret } from '../common/utils/secret-strength';

/**
 * Конфиг встраиваемого модуля. Хост-приложение (b24club-api или dev-харнесс)
 * передаёт его через `MastercardModule.forRootAsync({ useFactory })`. Модуль НЕ
 * читает `process.env` напрямую — поэтому переносится в чужой монолит без
 * завязки на конкретные имена env-переменных.
 */
export interface MastercardModuleOptions {
  /** Базовый URL Mastercard (sandbox/MTF/prod). */
  readonly baseUrl: string;
  /** Платформенные креды (режим PLATFORM; демо-сид OWN в dev). */
  readonly consumerKey: string;
  readonly partnerId: string;
  readonly signingKeyPath?: string;
  readonly signingKeyPassword?: string;
  /** Field-level encryption (JWE): включается в MTF/Prod. */
  readonly encryptionEnabled?: boolean;
  readonly encryptionCertPath?: string;
  readonly encryptionFingerprint?: string;
  readonly decryptionKeyPath?: string;
  /** Источник секретов мерчантов: 'local' (dev) | 'vault' (prod). */
  readonly secretStore?: 'local' | 'vault';
  /** TTL кэша OWN-кредов, мс. */
  readonly credsCacheTtlMs?: number;
  /** Секрет подписи внутренних JWT мерчантов. */
  readonly jwtSecret: string;
  /** Токен внутренних (service-to-service) вызовов. */
  readonly internalToken: string;
  /** Токен admin-API. */
  readonly adminToken: string;
  /** Shared-secret аутентификации вебхуков MC (обязателен — guard fail-closed). */
  readonly webhookToken?: string;
  /**
   * Окружение хоста. `'production'` включает прод-гейты (сильные секреты + vault)
   * и отключает засев тестовых тенантов. Хост ОБЯЗАН передать его в проде; если
   * не передан — модуль считает окружение не-production (гейты off). Модуль НЕ
   * читает `process.env.NODE_ENV` сам — значение только отсюда.
   */
  readonly nodeEnv?: string;
}

const DEFAULT_CREDS_TTL_MS = 10 * 60 * 1000;

/**
 * Типизированный доступ к опциям модуля. Заменяет точечные `ConfigService.get(...)`
 * во внутренних сервисах — единый источник конфигурации модуля. Предоставляется
 * глобально зонтичным `MastercardModule`, поэтому доступен всем под-сервисам.
 */
@Injectable()
export class GatewayConfig {
  constructor(private readonly opts: MastercardModuleOptions) {
    // Обязательные опции — fail-fast на СТАРТЕ, а не при первом запросе. Критично
    // для встраивания: хост передаёт options-объект напрямую, и env-валидация
    // dev-харнесса (ConfigModule.validate) на этом пути НЕ выполняется.
    const required = [
      'baseUrl',
      'consumerKey',
      'partnerId',
      'jwtSecret',
      'internalToken',
      'adminToken',
    ] as const;
    for (const k of required) {
      if (!opts[k]) {
        throw new Error(`MastercardModule: required option '${k}' is missing`);
      }
    }
    // Прод-гейты (раньше жили только в harness main.ts → при встраивании молча
    // не срабатывали). Теперь модуль сам не даёт стартовать в проде со слабыми
    // секретами или dev-секрет-стором — одинаково standalone и embedded.
    if (this.isProduction) {
      const bad = (
        ['jwtSecret', 'internalToken', 'adminToken', 'webhookToken'] as const
      ).filter((k) => isWeakSecret(opts[k]));
      if (bad.length) {
        throw new Error(
          `production: weak/default secrets — set strong values: ${bad.join(', ')}`,
        );
      }
      if (this.secretStore !== 'vault') {
        throw new Error(
          'production: secretStore must be "vault" — LocalSecretStore is for dev only',
        );
      }
    }
  }

  get baseUrl(): string {
    return this.opts.baseUrl;
  }
  get consumerKey(): string {
    return this.opts.consumerKey;
  }
  get partnerId(): string {
    return this.opts.partnerId;
  }
  get signingKeyPath(): string | undefined {
    return this.opts.signingKeyPath;
  }
  get signingKeyPassword(): string | undefined {
    return this.opts.signingKeyPassword;
  }
  get encryptionEnabled(): boolean {
    return this.opts.encryptionEnabled ?? false;
  }
  get encryptionCertPath(): string | undefined {
    return this.opts.encryptionCertPath;
  }
  get encryptionFingerprint(): string | undefined {
    return this.opts.encryptionFingerprint;
  }
  get decryptionKeyPath(): string | undefined {
    return this.opts.decryptionKeyPath;
  }
  get secretStore(): 'local' | 'vault' {
    return this.opts.secretStore ?? 'local';
  }
  get credsCacheTtlMs(): number {
    return this.opts.credsCacheTtlMs && this.opts.credsCacheTtlMs > 0
      ? this.opts.credsCacheTtlMs
      : DEFAULT_CREDS_TTL_MS;
  }
  get jwtSecret(): string {
    return this.opts.jwtSecret;
  }
  get internalToken(): string {
    return this.opts.internalToken;
  }
  get adminToken(): string {
    return this.opts.adminToken;
  }
  get webhookToken(): string | undefined {
    return this.opts.webhookToken;
  }
  get isProduction(): boolean {
    // Только из опций хоста — модуль встраиваемый и НЕ читает process.env сам
    // (иначе завязка на конкретное имя env-переменной в чужом монолите). Хост
    // передаёт nodeEnv через forRootAsync (харнесс — из ConfigService NODE_ENV).
    return this.opts.nodeEnv === 'production';
  }

  /** Обязательное значение или громкая ошибка (для ключей, нужных в конкретном режиме). */
  require<K extends keyof MastercardModuleOptions>(
    key: K,
  ): NonNullable<MastercardModuleOptions[K]> {
    const v = this.opts[key];
    if (v === undefined || v === null || v === '') {
      throw new Error(
        `MastercardModule option '${String(key)}' is required but not set`,
      );
    }
    return v as NonNullable<MastercardModuleOptions[K]>;
  }
}
