import {
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import {
  loadPrivateKeyFromP12,
  loadPrivateKeyFromP12Base64,
} from '../../common/utils/p12.util';
import { Tenant } from '../../tenants/tenant.types';
import {
  KeyMaterial,
  MerchantSecretBundle,
  SECRET_STORE,
  SecretStore,
} from '../../secrets/secret-store.types';
import { McCredentials } from '../credentials.types';
import { safePartnerId, safeSecretRef } from '../utils/credential-sanitize';
import { OwnCredentialsCache } from './own-credentials.cache';

/**
 * OWN credentials: a merchant's own keys from the SecretStore (Vault/KMS),
 * fetched, validated and normalised to PEM, then cached (TTL + LRU + stampede,
 * see OwnCredentialsCache). Split out of CredentialsService (issue #14).
 */
@Injectable()
export class OwnCredentialsProvider {
  private readonly logger = new Logger(OwnCredentialsProvider.name);
  private readonly cache: OwnCredentialsCache;

  constructor(
    config: GatewayConfig,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
  ) {
    this.cache = new OwnCredentialsCache(config.credsCacheTtlMs);
  }

  get(tenant: Tenant): Promise<McCredentials> {
    return this.cache.getOrCreate(tenant.id, () => this.fetch(tenant));
  }

  /** Drop a merchant's cached credentials (for key rotation). */
  invalidate(tenantId: string): void {
    this.cache.invalidate(tenantId);
  }

  private async fetch(tenant: Tenant): Promise<McCredentials> {
    if (!tenant.secretRef) {
      // Incomplete tenant config — not a server crash (500) but "tenant is not
      // configured" → 422. Detail (id) to the log, not the response.
      this.logger.error(`Tenant '${tenant.id}' (OWN) has no secretRef`);
      throw new UnprocessableEntityException(
        'tenant credentials are not configured',
      );
    }
    const secretRef = safeSecretRef(tenant.secretRef, tenant.id);

    const bundle = await this.secrets.getMerchantSecrets(secretRef);
    this.validateBundle(secretRef, bundle);

    const creds: McCredentials = {
      consumerKey: bundle.consumerKey,
      // an explicit tenant partnerId wins, otherwise the one from the bundle
      partnerId: safePartnerId(tenant.partnerId ?? bundle.partnerId, tenant.id),
      signingKeyPem: this.toPem(bundle.signing),
      encryptionCertPem: bundle.encryptionCertPem,
      encryptionFingerprint: bundle.encryptionFingerprint,
      decryptionKeyPem: bundle.decryption
        ? this.toPem(bundle.decryption)
        : undefined,
    };

    this.logger.log(`OWN credentials for tenant '${tenant.id}' cached`);
    return creds;
  }

  /** Secret-boundary validation: the bundle must hold the minimum to sign. */
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

  /** Normalise key material (path | base64) to PEM. */
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
