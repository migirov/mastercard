import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { AuditService } from '../audit/audit.service';
import { strictDtoPipe } from '../common/validation.pipe';
import { TenantRegistry } from '../tenants/tenant.registry';
import { effectiveStatus, Tenant } from '../tenants/tenant.types';
import { AdminService } from './admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

/** Admin-API: ввод партнёров, одобрения, выпуск/отзыв OAuth-клиентов. */
@Controller('admin')
@UseGuards(AdminAuthGuard, ThrottlerGuard)
@UsePipes(strictDtoPipe()) // строгая валидация DTO на нашей границе
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly registry: TenantRegistry,
    private readonly audit: AuditService,
  ) {}

  // --- аудит ---

  @Get('audit')
  auditLog() {
    return this.audit.recent(200);
  }

  // --- партнёры ---

  @Get('tenants')
  async list() {
    const tenants = await this.registry.list();
    return tenants.map((t) => this.view(t));
  }

  @Get('tenants/:id')
  async getOne(@Param('id') id: string) {
    return this.view(await this.registry.get(id));
  }

  @Post('tenants')
  async create(@Body() body: CreateTenantDto) {
    return this.view(await this.admin.createTenant(body));
  }

  // --- одобрения / блокировка ---

  @Post('tenants/:id/approve/platform')
  async approvePlatform(@Param('id') id: string) {
    return this.view(await this.admin.approvePlatform(id));
  }

  @Post('tenants/:id/approve/mastercard')
  async approveMastercard(@Param('id') id: string) {
    return this.view(await this.admin.approveMastercard(id));
  }

  @Post('tenants/:id/suspend')
  async suspend(@Param('id') id: string) {
    return this.view(await this.admin.suspend(id));
  }

  @Post('tenants/:id/unsuspend')
  async unsuspend(@Param('id') id: string) {
    return this.view(await this.admin.unsuspend(id));
  }

  // --- OAuth-клиенты ---

  @Post('tenants/:id/clients')
  async issueClient(@Param('id') id: string) {
    const creds = await this.admin.issueClient(id);
    return {
      ...creds,
      note: 'client_secret показан один раз — сохраните его сейчас',
    };
  }

  @Delete('clients/:clientId')
  revokeClient(@Param('clientId') clientId: string) {
    return this.admin.revokeClient(clientId);
  }

  /** Представление без secretRef, с вычисленным статусом. */
  private view(t: Tenant) {
    const { secretRef: _secretRef, ...pub } = t as Tenant & {
      secretRef?: string;
    };
    return { ...pub, status: effectiveStatus(t) };
  }
}
