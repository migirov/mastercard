import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { loadPrivateKeyFromP12 } from '../../common/utils/p12.util';
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

    const signingKeyPem = loadPrivateKeyFromP12(
      this.config.require('signingKeyPath'),
      this.config.require('signingKeyPassword'),
    );
    this.cache = {
      consumerKey: this.config.require('consumerKey'),
      signingKeyPem,
      partnerId: safePartnerId(this.config.require('partnerId'), 'platform'),
      encryptionFingerprint: this.config.encryptionFingerprint,
    };
    this.logger.log('Platform credentials loaded and cached');
    return this.cache;
  }
}
