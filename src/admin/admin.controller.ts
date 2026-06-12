import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseFilters,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { AuditService } from '../audit/audit.service';
import { GatewayExceptionFilter } from '../common/gateway-exception.filter';
import { SafeIdPipe } from '../common/safe-id.pipe';
import { strictDtoPipe } from '../common/validation.pipe';
import { TenantRegistry } from '../tenants/tenant.registry';
import { effectiveStatus, Tenant } from '../tenants/tenant.types';
import { AdminService } from './admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantViewDto } from './dto/tenant-view.dto';

/** Admin-API: ввод партнёров, одобрения, выпуск/отзыв OAuth-клиентов. */
@ApiTags('admin')
@ApiSecurity('admin')
@Controller('admin')
@UseGuards(AdminAuthGuard, ThrottlerGuard)
@UsePipes(strictDtoPipe()) // строгая валидация DTO на нашей границе
@UseFilters(GatewayExceptionFilter)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly registry: TenantRegistry,
    private readonly audit: AuditService,
  ) {}

  // --- аудит ---

  @Get('audit')
  @ApiOperation({ summary: 'Последние записи аудита (без тел/секретов).' })
  auditLog() {
    return this.audit.recent(200);
  }

  // --- партнёры ---

  @Get('tenants')
  @ApiOperation({ summary: 'Список партнёров.' })
  @ApiResponse({ status: 200, type: TenantViewDto, isArray: true })
  async list() {
    const tenants = await this.registry.list();
    return tenants.map((t) => this.view(t));
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Партнёр по id.' })
  @ApiResponse({ status: 200, type: TenantViewDto })
  async getOne(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.registry.get(id));
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Создать партнёра (OWN требует secretRef).' })
  @ApiResponse({ status: 201, type: TenantViewDto })
  async create(@Body() body: CreateTenantDto) {
    return this.view(await this.admin.createTenant(body));
  }

  // --- одобрения / блокировка ---

  // Эти действия МУТИРУЮТ состояние, но ничего не СОЗДАЮТ → 200, а не дефолтный
  // для POST 201 (201 оставлен только за реальным созданием — POST /tenants).
  @Post('tenants/:id/approve/platform')
  @HttpCode(200)
  @ApiOperation({ summary: 'Одобрение со стороны платформы.' })
  async approvePlatform(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.approvePlatform(id));
  }

  @Post('tenants/:id/approve/mastercard')
  @HttpCode(200)
  @ApiOperation({ summary: 'Одобрение со стороны Mastercard.' })
  async approveMastercard(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.approveMastercard(id));
  }

  @Post('tenants/:id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Заблокировать партнёра.' })
  async suspend(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.suspend(id));
  }

  @Post('tenants/:id/unsuspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Снять блокировку.' })
  async unsuspend(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.unsuspend(id));
  }

  // --- OAuth-клиенты ---

  @Post('tenants/:id/clients')
  @ApiOperation({
    summary: 'Выпустить OAuth-клиента (client_secret показан 1 раз).',
  })
  async issueClient(@Param('id', SafeIdPipe) id: string) {
    const creds = await this.admin.issueClient(id);
    return {
      ...creds,
      note: 'client_secret показан один раз — сохраните его сейчас',
    };
  }

  @Delete('clients/:clientId')
  @ApiOperation({ summary: 'Отозвать OAuth-клиента.' })
  async revokeClient(@Param('clientId', SafeIdPipe) clientId: string) {
    const res = await this.admin.revokeClient(clientId);
    // 404 на несуществующий/уже отозванный клиент — иначе 200 {revoked:false}
    // не отличить от успешного отзыва (опечатка в id выглядит как успех).
    if (!res.revoked) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }
    return res;
  }

  /** Представление без secretRef, с вычисленным статусом. */
  private view(t: Tenant): TenantViewDto {
    const { secretRef: _secretRef, ...pub } = t as Tenant & {
      secretRef?: string;
    };
    return { ...pub, status: effectiveStatus(t) };
  }
}
