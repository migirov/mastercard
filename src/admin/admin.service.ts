import { BadRequestException, Injectable } from '@nestjs/common';
import { ClientRegistry } from '../auth/client-registry';
import { CreateTenantInput, TenantRegistry } from '../tenants/tenant.registry';
import { CredentialMode } from '../tenants/tenant.types';

/** Оркестрация admin-операций над партнёрами и их OAuth-клиентами. */
@Injectable()
export class AdminService {
  constructor(
    private readonly tenants: TenantRegistry,
    private readonly clients: ClientRegistry,
  ) {}

  createTenant(input: CreateTenantInput) {
    if (!input?.name || !input?.credentialMode) {
      throw new BadRequestException('name and credentialMode are required');
    }
    if (!Object.values(CredentialMode).includes(input.credentialMode)) {
      throw new BadRequestException('credentialMode: PLATFORM | OWN');
    }
    if (input.credentialMode === CredentialMode.OWN && !input.secretRef) {
      throw new BadRequestException('secretRef is required for OWN');
    }
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

  /** Выпустить OAuth-клиента партнёру (сырой секрет возвращается один раз). */
  async issueClient(id: string) {
    await this.tenants.get(id); // 404, если партнёра нет
    return this.clients.issue(id);
  }

  async revokeClient(clientId: string) {
    return { revoked: await this.clients.revoke(clientId) };
  }
}
