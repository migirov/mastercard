import { Injectable } from '@nestjs/common';
import { ClientRegistry } from '../../auth/services/client-registry';
import {
  CreateTenantInput,
  TenantRegistry,
} from '../../tenants/services/tenant.registry';

/** Orchestrates admin operations on partners and their OAuth clients. */
@Injectable()
export class AdminService {
  constructor(
    private readonly tenants: TenantRegistry,
    private readonly clients: ClientRegistry,
  ) {}

  // Input validation (required fields, secretRef for OWN) is declarative in
  // CreateTenantDto + the Strict preset of the shared validation strategy on AdminController.
  // Only the business action lives here.
  createTenant(input: CreateTenantInput) {
    return this.tenants.create(input);
  }

  approvePlatform(id: string) {
    return this.tenants.setPlatformApproved(id, true);
  }

  approveMastercard(id: string) {
    return this.tenants.setMcApproved(id, true);
  }

  suspend(id: string) {
    return this.tenants.setSuspended(id, true);
  }

  unsuspend(id: string) {
    return this.tenants.setSuspended(id, false);
  }

  /** Issue an OAuth client to a partner (the raw secret is returned once). */
  async issueClient(id: string) {
    await this.tenants.get(id); // 404 if the partner does not exist
    return this.clients.issue(id);
  }

  async revokeClient(clientId: string) {
    return { revoked: await this.clients.revoke(clientId) };
  }
}
