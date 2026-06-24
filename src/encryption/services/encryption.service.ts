import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JweEncryption } from 'mastercard-client-encryption';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import * as path from 'path';

/** Constant path-config key (we encrypt the whole body identically for everyone). */
const ENDPOINT = '/crossborder';

/**
 * Cap on cached per-tenant `JweEncryption` instances (one per distinct key
 * fingerprint). Key rotation produces new fingerprints; on overflow we drop the
 * whole cache — instances are rebuilt lazily on next use, so this is cheap.
 */
const OWN_JWE_CACHE_MAX = 256;

/** Shape of an encrypted MC response: `{ encrypted_payload: { data: <JWE> } }`. */
interface EncryptedEnvelope {
  encrypted_payload?: { data?: unknown };
}

/**
 * Field-level encryption (JWE) per the Mastercard docs. FLE works in every
 * environment, including sandbox (confirmed live), as well as MTF/Production.
 *
 * Key direction (do NOT mix up — the inverse choice produced error `082000 Crypto Key`):
 *  • Encrypt the REQUEST with the Client Encryption Key — the public MC cert
 *    (`encryptionCert*` + `encryptionFingerprint`); Mastercard holds the private
 *    pair and decrypts our request.
 *  • Decrypt the RESPONSE with the Mastercard Encryption private key
 *    (`decryptionKey*`); MC uses its public pair to encrypt the response to us.
 *
 * PLATFORM vs OWN keys. A PLATFORM tenant uses one shared `JweEncryption` built
 * from the module config (file paths) at startup. An OWN partner has its own MC
 * project → its own keys, which resolve into `McCredentials` (`encryptionCertPem` /
 * `encryptionFingerprint` / `decryptionKeyPem`). For OWN we build a per-tenant
 * `JweEncryption` from that PEM content (`useCertificateContent` — no temp files),
 * cached by fingerprint. The `MastercardClient` interceptor already passes `creds`,
 * so key selection lives entirely here.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  readonly enabled: boolean;
  /** Shared PLATFORM-key instance, built from config in `onModuleInit`. */
  private jwe?: JweEncryption;
  /** Per-tenant OWN-key instances, keyed by encryption fingerprint. */
  private readonly ownJwe = new Map<string, JweEncryption>();

  constructor(private readonly config: GatewayConfig) {
    this.enabled = config.encryptionEnabled;
  }

  /**
   * Build the platform `JweEncryption` (file I/O) in a lifecycle hook, NOT the
   * constructor (Nest convention: side-effect-free constructors; consistent with
   * AuditService/PlatformCredentialsProvider, which also initialize in hooks).
   */
  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Field-level encryption disabled — plain passthrough');
      return;
    }
    // When embedded in the monolith, cwd = the HOST's working directory (not our
    // package) → relative cert/key paths resolve from the host. The host must pass
    // ABSOLUTE encryptionCertPath/decryptionKeyPath in the module options (the
    // harness uses paths from the project root). path.resolve leaves already-absolute
    // paths unchanged.
    const cwd = process.cwd();
    this.jwe = this.buildJwe({
      useCertificateContent: false,
      encryptionCertificate: path.resolve(
        cwd,
        this.config.require('encryptionCertPath'),
      ),
      privateKey: path.resolve(cwd, this.config.require('decryptionKeyPath')),
      fingerprint: this.config.require('encryptionFingerprint'),
    });
    this.logger.log('Field-level encryption ENABLED (works on sandbox too)');
  }

  /** Encrypt the request body with the tenant's key (OWN) or the platform key. */
  encryptRequest(
    creds: McCredentials,
    body: unknown,
  ): { body: unknown; encrypted: boolean } {
    if (!this.enabled) return { body, encrypted: false };
    const out = this.jweFor(creds).encrypt(ENDPOINT, {}, body);
    return { body: out.body, encrypted: true };
  }

  /** Decrypt the response body if enveloped; otherwise passthrough. */
  decryptResponse<T = unknown>(creds: McCredentials, body: T): T {
    if (!this.enabled) return body;
    const env = body as unknown as EncryptedEnvelope;
    if (!env?.encrypted_payload?.data) return body; // already plain
    return this.jweFor(creds).decrypt({
      request: { url: ENDPOINT },
      body,
    }) as T;
  }

  /**
   * Pick the `JweEncryption` for these creds: a per-tenant instance for an OWN
   * tenant (its own keys), otherwise the shared platform instance.
   */
  private jweFor(creds: McCredentials): JweEncryption {
    if (creds.encryptionCertPem) return this.ownJweFor(creds);
    if (!this.jwe) {
      // enabled === true ⇒ onModuleInit built it; defensive only.
      throw new Error('platform field-level encryption is not initialized');
    }
    return this.jwe;
  }

  /** Build (or reuse) the per-tenant `JweEncryption` for an OWN tenant. */
  private ownJweFor(creds: McCredentials): JweEncryption {
    const fp = creds.encryptionFingerprint;
    if (!creds.encryptionCertPem || !creds.decryptionKeyPem || !fp) {
      // OWN tenant with FLE enabled but incomplete key material — refuse loudly
      // rather than silently encrypt with a wrong/foreign key (MC would reject it).
      throw new Error(
        'OWN tenant has incomplete encryption keys: encryptionCertPem, ' +
          'encryptionFingerprint and decryptionKeyPem are all required for ' +
          'field-level encryption.',
      );
    }
    let jwe = this.ownJwe.get(fp);
    if (!jwe) {
      if (this.ownJwe.size >= OWN_JWE_CACHE_MAX) this.ownJwe.clear();
      jwe = this.buildJwe({
        useCertificateContent: true,
        encryptionCertificate: creds.encryptionCertPem,
        privateKey: creds.decryptionKeyPem,
        fingerprint: fp,
      });
      this.ownJwe.set(fp, jwe);
    }
    return jwe;
  }

  /**
   * Construct a `JweEncryption`. With `useCertificateContent: true` the library
   * reads `encryptionCertificate`/`privateKey` as PEM CONTENT (OWN per-tenant);
   * with `false` it reads them as file PATHS (the PLATFORM config).
   */
  private buildJwe(opts: {
    useCertificateContent: boolean;
    encryptionCertificate: string;
    privateKey: string;
    fingerprint: string;
  }): JweEncryption {
    // Fingerprint = SHA-256 of the public key in hex (64 chars). Validate the
    // format, do NOT coerce: otherwise a cert fingerprint (with colons) or base64
    // would silently become a wrong JWE `kid`, and MC would reject the request.
    if (!/^[0-9a-f]{64}$/i.test(opts.fingerprint)) {
      throw new Error(
        'MC encryption fingerprint must be the 64-hex SHA-256 public-key fingerprint',
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
      useCertificateContent: opts.useCertificateContent,
      encryptionCertificate: opts.encryptionCertificate,
      publicKeyFingerprint: opts.fingerprint.toLowerCase(),
      privateKey: opts.privateKey,
    });
  }
}
