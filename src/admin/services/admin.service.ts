import { Injectable } from '@nestjs/common';
import { ClientRegistry } from '../../auth/services/client-registry';
import {
  CreateTenantInput,
  TenantRegistry,
} from '../../tenants/services/tenant.registry';

/** Оркестрация admin-операций над партнёрами и их OAuth-клиентами. */
@Injectable()
export class AdminService {
  constructor(
    private readonly tenants: TenantRegistry,
    private readonly clients: ClientRegistry,
  ) {}

  // Валидация входа (обязательность полей, secretRef для OWN) — декларативно в
  // CreateTenantDto + пресет Strict общей стратегии валидации на AdminController.
  // Здесь только бизнес-действие.
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

  /** Выпустить OAuth-клиента партнёру (сырой секрет возвращается один раз). */
  async issueClient(id: string) {
    await this.tenants.get(id); // 404, если партнёра нет
    return this.clients.issue(id);
  }

  async revokeClient(clientId: string) {
    return { revoked: await this.clients.revoke(clientId) };
  }
}
