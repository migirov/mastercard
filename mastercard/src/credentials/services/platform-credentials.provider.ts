import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { loadSigningMaterialFromP12 } from '../../common/utils/p12.util';
import { McCredentials } from '../credentials.types';
import { safePartnerId } from '../utils/credential-sanitize';

/**
 * PLATFORM credentials: shared platform keys from configuration, cached without
 * TTL (rotation is via restart — this is an infrastructure secret). Split out of
 * CredentialsService (issue #14).
 */
@Injectable()
export class PlatformCredentialsProvider implements OnModuleInit {
  private readonly logger = new Logger(PlatformCredentialsProvider.name);
  private cache?: McCredentials;

  constructor(private readonly config: GatewayConfig) {}

  /** Warm platform credentials at startup: fail-fast (a bad .p12/password fails
   *  boot, not the first request) + the first PLATFORM request does not wait on
   *  the parse. */
  onModuleInit(): void {
    this.get();
  }

  get(): McCredentials {
    if (this.cache) return this.cache;

    // The certificate comes along for free (same parse) and is what the OAuth2
    // request-token strategy needs; populate it regardless of the active auth mode
    // so the credential shape stays uniform.
    const signing = loadSigningMaterialFromP12(
      this.config.require('signingKeyPath'),
      this.config.require('signingKeyPassword'),
    );
    // Validate BEFORE caching. If the assignment came first, the throw would fire
    // only on the very first call and every later `get()` would hand back the
    // invalid credentials with the guard silently gone — which is exactly the
    // opaque-502-on-every-payment failure this check exists to prevent.
    //
    // Fail at boot, not on every payment: the OAuth2 request token derives its
    // `x5t#S256` from the signing certificate, so a key-only .p12 in that mode is
    // unusable. Same reasoning as the baseUrl/authMode gate in GatewayConfig.
    // (OWN tenants resolve lazily and are checked in OwnCredentialsProvider.)
    if (
      this.config.authMode === 'oauth2-request-token' &&
      !signing.certThumbprintS256
    ) {
      throw new Error(
        'MC_AUTH_MODE=oauth2-request-token requires the signing certificate, but ' +
          `'${this.config.require('signingKeyPath')}' holds a private key with no ` +
          'certificate — re-export the .p12 including it',
      );
    }

    this.cache = {
      consumerKey: this.config.require('consumerKey'),
      signingKeyPem: signing.privateKeyPem,
      partnerId: safePartnerId(this.config.require('partnerId'), 'platform'),
      encryptionFingerprint: this.config.encryptionFingerprint,
      signingCertPem: signing.certPem,
      signingCertThumbprintS256: signing.certThumbprintS256,
    };
    this.logger.log('Platform credentials loaded and cached');
    return this.cache;
  }
}
