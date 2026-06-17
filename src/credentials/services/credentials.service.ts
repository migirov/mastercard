import { Injectable } from '@nestjs/common';
import { CredentialMode, Tenant } from '../../tenants/tenant.types';
import { McCredentials } from '../credentials.types';
import { OwnCredentialsProvider } from './own-credentials.provider';
import { PlatformCredentialsProvider } from './platform-credentials.provider';

/**
 * Credentials facade. One interface over the two modes, delegating to focused
 * providers (issue #14 split):
 *   PLATFORM — shared platform keys      → PlatformCredentialsProvider
 *   OWN      — merchant keys (SecretStore) → OwnCredentialsProvider
 * The rest of the code works only with this service and McCredentials, unaware
 * whether the keys are the platform's or the merchant's own.
 */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly platform: PlatformCredentialsProvider,
    private readonly own: OwnCredentialsProvider,
  ) {}

  resolve(tenant: Tenant): Promise<McCredentials> {
    switch (tenant.credentialMode) {
      case CredentialMode.PLATFORM:
        return Promise.resolve(this.platform.get());
      case CredentialMode.OWN:
        return this.own.get(tenant);
      default:
        throw new Error(`Unknown credentialMode for tenant '${tenant.id}'`);
    }
  }

  /** Reset a merchant's cached credentials (for key rotation). */
  invalidate(tenantId: string): void {
    this.own.invalidate(tenantId);
  }
}
