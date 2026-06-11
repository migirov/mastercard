import { Injectable, Logger } from '@nestjs/common';
import { GatewayConfig } from '../config/gateway-config';
import * as path from 'path';
// CommonJS-пакет Mastercard, без типов
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JweEncryption } = require('mastercard-client-encryption');

/** Постоянный ключ конфигурации путей (шифруем тело целиком одинаково для всех). */
const ENDPOINT = '/crossborder';

/**
 * Field-level encryption (JWE) по доке Mastercard.
 * Тумблер MC_ENCRYPTION_ENABLED: в sandbox = false (plain, sandbox не
 * поддерживает FLE), в MTF/Production = true.
 *
 * Шифрование запроса использует Mastercard Encryption Key (публичный cert),
 * расшифровка ответа — наш Client Encryption private key.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  readonly enabled: boolean;
  private jwe?: {
    encrypt: (
      path: string,
      headers: object,
      body: unknown,
    ) => { body: unknown };
    decrypt: (input: { request: { url: string }; body: unknown }) => unknown;
  };

  constructor(private readonly config: GatewayConfig) {
    this.enabled = config.encryptionEnabled;
    if (this.enabled) {
      this.jwe = this.buildJwe();
      this.logger.log('Field-level encryption ВКЛЮЧЕНА (MTF/Production)');
    } else {
      this.logger.log('Field-level encryption выключена — plain (sandbox)');
    }
  }

  /** Шифрует тело запроса. Возвращает тело и флаг, было ли шифрование. */
  encryptRequest(body: unknown): { body: unknown; encrypted: boolean } {
    if (!this.enabled || !this.jwe) return { body, encrypted: false };
    const out = this.jwe.encrypt(ENDPOINT, {}, body);
    return { body: out.body, encrypted: true };
  }

  /** Расшифровывает тело ответа, если оно зашифровано; иначе passthrough. */
  decryptResponse<T = unknown>(body: T): T {
    if (!this.enabled || !this.jwe) return body;
    if (!(body as any)?.encrypted_payload?.data) return body; // уже plain
    return this.jwe.decrypt({ request: { url: ENDPOINT }, body }) as T;
  }

  private buildJwe() {
    const cwd = process.cwd();
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
      publicKeyFingerprint: this.config
        .require('encryptionFingerprint')
        .toLowerCase(),
      // Наш Client Encryption private key (PEM) — им расшифровываем ответ.
      privateKey: path.resolve(cwd, this.config.require('decryptionKeyPath')),
    });
  }
}
