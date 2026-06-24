import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JweEncryption } from 'mastercard-client-encryption';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import * as path from 'path';

/** Constant path-config key (we encrypt the whole body identically for everyone). */
const ENDPOINT = '/crossborder';

/** Shape of an encrypted MC response: `{ encrypted_payload: { data: <JWE> } }`. */
interface EncryptedEnvelope {
  encrypted_payload?: { data?: unknown };
}

/**
 * Field-level encryption (JWE) per the Mastercard docs.
 * The MC_ENCRYPTION_ENABLED toggle is turned on wherever keys are configured —
 * sandbox also supports FLE (confirmed live), as do MTF/Production.
 *
 * Key direction (do NOT mix up — the inverse choice produced error `082000 Crypto Key`):
 *  • Encrypt the REQUEST with the Client Encryption Key — the public MC cert
 *    (`encryptionCertPath` + `encryptionFingerprint`); Mastercard holds the
 *    private pair and decrypts our request.
 *  • Decrypt the RESPONSE with OUR Mastercard Encryption private key
 *    (`decryptionKeyPath`); MC uses its public pair to encrypt the response to us.
 *
 * PER-TENANT MIGRATION (open blocker): the service currently builds ONE
 * `JweEncryption` from the PLATFORM paths in the constructor. OWN partners have
 * their own MC encryption keys (`creds.encryptionCertPem`/`encryptionFingerprint`/
 * `decryptionKeyPem` already resolve into `McCredentials`, but are NOT used yet).
 * The methods deliberately take `creds` in their signature — the contract is
 * already per-tenant, so once MTF access and real keys are available, ONLY the
 * internals here change (a per-tenant `JweEncryption` cache keyed by fingerprint),
 * and the `MastercardClient` interceptor needs no changes. Until then `creds` is
 * ignored (single-key mode).
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  readonly enabled: boolean;
  private jwe?: JweEncryption;

  constructor(private readonly config: GatewayConfig) {
    this.enabled = config.encryptionEnabled;
  }

  /** Build JweEncryption (file I/O) in a lifecycle hook, NOT in the constructor
   *  (Nest convention: side-effect-free constructors; consistent with
   *  AuditService/PlatformCredentialsProvider, which also initialize in hooks). */
  onModuleInit(): void {
    if (this.enabled) {
      this.jwe = this.buildJwe();
      this.logger.log('Field-level encryption ENABLED (works on sandbox too)');
    } else {
      this.logger.log('Field-level encryption disabled — plain passthrough');
    }
  }

  /**
   * Encrypts the request body in a creds-dependent way. `creds` is for the future
   * per-tenant key (see the class note); currently used only for the fail-loud check.
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
   * Decrypts the response body if encrypted; otherwise passthrough. `creds` is
   * for the future per-tenant decryption key; currently only for fail-loud.
   */
  decryptResponse<T = unknown>(creds: McCredentials, body: T): T {
    if (!this.enabled || !this.jwe) return body;
    this.assertPlatformKeyUsable(creds);
    const env = body as unknown as EncryptedEnvelope;
    if (!env?.encrypted_payload?.data) return body; // already plain
    return this.jwe.decrypt({ request: { url: ENDPOINT }, body }) as T;
  }

  /**
   * Fail-loud: per-tenant encryption is NOT yet implemented (single-key mode, see
   * the class note). If a tenant has its OWN key material (OWN —
   * `encryptionCertPem`/`decryptionKeyPem` from its bundle), we must NOT silently
   * encrypt/decrypt with the PLATFORM key: MC would reject it (foreign `kid`), and
   * worst case it is cross-tenant key use. Until the seam is built, refuse
   * explicitly (rather than doing the wrong thing silently). Only triggers when
   * `MC_ENCRYPTION_ENABLED` is on AND the tenant is OWN — a dangerous combination
   * that nothing caught before. For PLATFORM creds (these fields absent) it is a no-op.
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
    // When embedded in the monolith, cwd = the HOST's working directory (not our
    // package) → relative cert/key paths resolve from the host. The host must pass
    // ABSOLUTE encryptionCertPath/decryptionKeyPath in the module options (the
    // harness uses paths from the project root). path.resolve leaves already-absolute
    // paths unchanged.
    const cwd = process.cwd();
    // Fingerprint = SHA-256 of the public key in hex (64 chars). Validate the
    // format, do NOT coerce: otherwise a cert fingerprint (with colons) or base64
    // would silently become a wrong JWE `kid`, and MC would reject the encrypted request.
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
      // Client Encryption Key (public MC cert) — used to encrypt the REQUEST.
      encryptionCertificate: path.resolve(
        cwd,
        this.config.require('encryptionCertPath'),
      ),
      publicKeyFingerprint: fingerprint.toLowerCase(),
      // Our Mastercard Encryption private key (PEM) — used to decrypt the RESPONSE.
      privateKey: path.resolve(cwd, this.config.require('decryptionKeyPath')),
    });
  }
}
