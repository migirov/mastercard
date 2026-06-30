import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JweEncryption } from 'mastercard-client-encryption';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';

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
 * Read the `kid` (public-key fingerprint) from a JWE compact serialization's
 * protected JOSE header — base64url and in cleartext (the segment before the first
 * dot). MC sets `kid` to the fingerprint of the key needed to decrypt the message,
 * so it lets us pick the right private key BEFORE decrypting.
 */
function jweKid(jwe: string): string | undefined {
  const header = jwe.split('.', 1)[0];
  if (!header) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(header, 'base64url').toString('utf8'),
    );
    const kid = (parsed as { kid?: unknown }).kid;
    return typeof kid === 'string' && kid ? kid : undefined;
  } catch {
    return undefined;
  }
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
  /** Platform key fingerprint (lowercased) — to route encrypted pushes by `kid`. */
  private platformFp?: string;

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
    // The module never reads process.cwd(): the host (or the dev harness) passes ABSOLUTE
    // encryptionCertPath/decryptionKeyPath in the module options. `require(...)` is fail-loud
    // — these are mandatory when encryption is on.
    const fingerprint = this.config.require('encryptionFingerprint');
    this.jwe = this.buildJwe({
      useCertificateContent: false,
      encryptionCertificate: this.config.require('encryptionCertPath'),
      privateKey: this.config.require('decryptionKeyPath'),
      fingerprint,
    });
    this.platformFp = fingerprint.toLowerCase();
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
   * Decrypt an encrypted PUSH envelope `{encrypted_payload:{data:<JWE>}}`, routing on
   * the JWE `kid` (the fingerprint MC puts in the JOSE header — see the MC encryption
   * docs): no kid / the PLATFORM fingerprint → the platform key; an OWN tenant's
   * fingerprint → its per-tenant key IF already built (cached from that tenant's API
   * activity). Returns the decrypted body, or `undefined` if FLE is off, the body is
   * not an encrypted envelope, no key matches the `kid`, or decryption fails — the
   * caller then persists the envelope as-is (no data loss) for later reprocessing.
   *
   * A real encrypted push only occurs in MTF/Prod (sandbox push is "Not Applicable"),
   * where the assumption that the push carries a `kid` and the OWN cold-cache path are
   * confirmed.
   */
  decryptPush(envelope: unknown): unknown | undefined {
    if (!this.enabled || !this.jwe) return undefined;
    const data = (envelope as EncryptedEnvelope)?.encrypted_payload?.data;
    if (typeof data !== 'string' || !data) return undefined;
    const kid = jweKid(data);
    const jwe = this.jweForKid(kid);
    if (!jwe) return undefined;
    try {
      return jwe.decrypt({ request: { url: ENDPOINT }, body: envelope });
    } catch (e) {
      this.logger.warn(
        `Push decryption failed (kid=${kid ?? 'none'}): ${(e as Error).message}`,
      );
      return undefined;
    }
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

  /**
   * The JWE able to decrypt a message tagged with `kid`: the platform key (no kid or
   * the platform fingerprint), or a cached OWN per-tenant key. Returns undefined when
   * the kid belongs to an OWN tenant whose key has not been built yet.
   */
  private jweForKid(kid: string | undefined): JweEncryption | undefined {
    if (!kid || kid.toLowerCase() === this.platformFp) return this.jwe;
    return this.ownJwe.get(kid.toLowerCase());
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
    const key = fp.toLowerCase(); // fingerprints are hex; match the JWE `kid` case-insensitively
    let jwe = this.ownJwe.get(key);
    if (!jwe) {
      if (this.ownJwe.size >= OWN_JWE_CACHE_MAX) this.ownJwe.clear();
      jwe = this.buildJwe({
        useCertificateContent: true,
        encryptionCertificate: creds.encryptionCertPem,
        privateKey: creds.decryptionKeyPem,
        fingerprint: fp,
      });
      this.ownJwe.set(key, jwe);
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
