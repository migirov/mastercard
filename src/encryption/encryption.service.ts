import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JweEncryption } from 'mastercard-client-encryption';
import { GatewayConfig } from '../config/gateway-config';
import { McCredentials } from '../credentials/credentials.types';
import * as path from 'path';

/** Постоянный ключ конфигурации путей (шифруем тело целиком одинаково для всех). */
const ENDPOINT = '/crossborder';

/** Форма зашифрованного ответа MC: `{ encrypted_payload: { data: <JWE> } }`. */
interface EncryptedEnvelope {
  encrypted_payload?: { data?: unknown };
}

/**
 * Field-level encryption (JWE) по доке Mastercard.
 * Тумблер MC_ENCRYPTION_ENABLED: в sandbox = false (plain, sandbox не
 * поддерживает FLE), в MTF/Production = true.
 *
 * Шифрование запроса использует Mastercard Encryption Key (публичный cert),
 * расшифровка ответа — наш Client Encryption private key.
 *
 * ⚠️ ПЕРЕХОД НА PER-TENANT (открытый блокер): сейчас сервис строит ОДИН
 * `JweEncryption` из ПЛАТФОРМЕННЫХ путей в конструкторе. У OWN-партнёров —
 * собственные MC encryption-ключи (`creds.encryptionCertPem`/`encryptionFingerprint`/
 * `decryptionKeyPem` уже резолвятся в `McCredentials`, но пока НЕ используются).
 * Методы намеренно принимают `creds` в сигнатуре — контракт уже per-tenant, так
 * что когда будет доступ к MTF + реальные ключи, меняется ТОЛЬКО нутро здесь
 * (кэш per-tenant `JweEncryption` по fingerprint), а интерцептор `MastercardClient`
 * трогать не придётся. До тех пор `creds` игнорируется (одноключевой режим).
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  readonly enabled: boolean;
  private jwe?: JweEncryption;

  constructor(private readonly config: GatewayConfig) {
    this.enabled = config.encryptionEnabled;
  }

  /** Строим JweEncryption (файловое I/O) в lifecycle-хуке, а НЕ в конструкторе
   *  (конвенция Nest: конструктор без side-effect'ов; согласовано с
   *  AuditService/CredentialsService, которые тоже инициализируются в хуках). */
  onModuleInit(): void {
    if (this.enabled) {
      this.jwe = this.buildJwe();
      this.logger.log('Field-level encryption ВКЛЮЧЕНА (MTF/Production)');
    } else {
      this.logger.log('Field-level encryption выключена — plain (sandbox)');
    }
  }

  /**
   * Шифрует тело запроса креды-зависимо. `creds` — для будущего per-tenant ключа
   * (см. заметку на классе); сейчас используется только для fail-loud-проверки.
   */
  encryptRequest(
    creds: McCredentials,
    body: unknown,
  ): { body: unknown; encrypted: boolean } {
    if (!this.enabled || !this.jwe) return { body, encrypted: false };
    this.assertPlatformKeyUsable(creds);
    const out = this.jwe.encrypt(ENDPOINT, {}, body);
    return { body: out.body, encrypted: true };
  }

  /**
   * Расшифровывает тело ответа, если зашифровано; иначе passthrough. `creds` —
   * для будущего per-tenant ключа расшифровки; сейчас только для fail-loud.
   */
  decryptResponse<T = unknown>(creds: McCredentials, body: T): T {
    if (!this.enabled || !this.jwe) return body;
    this.assertPlatformKeyUsable(creds);
    const env = body as unknown as EncryptedEnvelope;
    if (!env?.encrypted_payload?.data) return body; // уже plain
    return this.jwe.decrypt({ request: { url: ENDPOINT }, body }) as T;
  }

  /**
   * Fail-loud: per-tenant encryption ещё НЕ реализована (одноключевой режим, см.
   * заметку на классе). Если у тенанта есть СОБСТВЕННЫЙ материал ключей (OWN —
   * `encryptionCertPem`/`decryptionKeyPem` из его бандла), мы НЕ имеем права молча
   * шифровать/расшифровывать его ПЛАТФОРМЕННЫМ ключом: MC отвергнет (чужой `kid`),
   * а в худшем случае это межтенантное использование ключа. Пока seam не достроен —
   * явно отказываем (а не делаем тихо неверно). Срабатывает лишь при включённом
   * `MC_ENCRYPTION_ENABLED` И OWN-тенанте — опасная комбинация, которую раньше
   * ничто не ловило. Для PLATFORM-кред (этих полей нет) — no-op.
   */
  private assertPlatformKeyUsable(creds: McCredentials): void {
    if (creds.encryptionCertPem || creds.decryptionKeyPem) {
      throw new Error(
        'Per-tenant encryption is not implemented: refusing to use the platform key ' +
          'for an OWN tenant that has its own MC encryption keys. Wire per-tenant keys ' +
          'into EncryptionService before enabling MC_ENCRYPTION_ENABLED for OWN tenants.',
      );
    }
  }

  private buildJwe() {
    // ⚠️ При встраивании в монолит cwd = рабочая директория ХОСТА (не нашего
    // пакета) → относительные cert/key-пути резолвятся от хоста. Хост должен
    // передавать АБСОЛЮТНЫЕ encryptionCertPath/decryptionKeyPath в опциях модуля
    // (харнесс использует пути от корня проекта). path.resolve пропускает уже
    // абсолютные пути без изменений.
    const cwd = process.cwd();
    // Fingerprint = SHA-256 публичного ключа в hex (64 символа). Валидируем формат,
    // а НЕ коэрсим: иначе cert-fingerprint (с двоеточиями) или base64 молча
    // превратятся в неверный JWE `kid`, и MC отвергнет шифрованный запрос.
    const fingerprint = this.config.require('encryptionFingerprint');
    if (!/^[0-9a-f]{64}$/i.test(fingerprint)) {
      throw new Error(
        'MC_ENCRYPTION_FINGERPRINT must be the 64-hex SHA-256 public-key fingerprint',
      );
    }
    return new JweEncryption({
      paths: [
        {
          path: ENDPOINT,
          toEncrypt: [{ element: '$', obj: 'encrypted_payload' }],
          toDecrypt: [{ element: 'encrypted_payload', obj: '$' }],
        },
      ],
      mode: 'JWE',
      encryptedValueFieldName: 'data',
      // Mastercard Encryption Key (публичный cert) — им шифруем запрос.
      encryptionCertificate: path.resolve(
        cwd,
        this.config.require('encryptionCertPath'),
      ),
      publicKeyFingerprint: fingerprint.toLowerCase(),
      // Наш Client Encryption private key (PEM) — им расшифровываем ответ.
      privateKey: path.resolve(cwd, this.config.require('decryptionKeyPath')),
    });
  }
}
