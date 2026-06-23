import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { AuditService } from '../../audit/services/audit.service';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { UseGatewayContract } from '../../common/decorators/gateway-contract.decorator';
import { SafeIdPipe } from '../../common/pipes/safe-id.pipe';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../common/pipes/gateway-validation.pipe';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { effectiveStatus, Tenant } from '../../tenants/tenant.types';
import { AdminService } from '../services/admin.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { IssuedClientDto } from '../dto/issued-client.dto';
import { TenantViewDto } from '../dto/tenant-view.dto';

/** Admin API: partner onboarding, approvals, OAuth client issuance/revocation. */
@ApiTags('admin')
@ApiSecurity('admin')
@ApiErrorResponses()
@Controller('admin')
@UseGuards(AdminAuthGuard, ThrottlerGuard)
// Strict DTO validation at our boundary (shared gateway strategy, Strict preset).
@UsePipes(gatewayValidationPipe(ValidationStrategy.Strict))
@UseGatewayContract() // unified error filter + audit (like the other controllers)
// ClassSerializerInterceptor (per-controller, not global — the module is embeddable):
// honors class-transformer decorators during serialization (backstops @Exclude on
// TenantEntity.secretRef). AuditInterceptor is added by UseGatewayContract.
@UseInterceptors(ClassSerializerInterceptor)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly registry: TenantRegistry,
    private readonly audit: AuditService,
  ) {}

  // --- audit ---

  @Get('audit')
  @ApiOperation({ summary: 'Recent audit records (without bodies/secrets).' })
  auditLog() {
    return this.audit.recent(200);
  }

  // --- partners ---

  @Get('tenants')
  @ApiOperation({ summary: 'List of partners.' })
  @ApiResponse({ status: 200, type: TenantViewDto, isArray: true })
  async list() {
    const tenants = await this.registry.list();
    return tenants.map((t) => this.view(t));
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Partner by id.' })
  @ApiResponse({ status: 200, type: TenantViewDto })
  async getOne(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.registry.get(id));
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Create a partner (OWN requires secretRef).' })
  @ApiResponse({ status: 201, type: TenantViewDto })
  async create(@Body() body: CreateTenantDto) {
    return this.view(await this.admin.createTenant(body));
  }

  // --- approvals / suspension ---

  // These actions MUTATE state but do not CREATE anything → 200, not the default
  // POST 201 (201 is reserved for actual creation — POST /tenants).
  @Post('tenants/:id/approve/platform')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approval from the platform side.' })
  async approvePlatform(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.approvePlatform(id));
  }

  @Post('tenants/:id/approve/mastercard')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approval from the Mastercard side.' })
  async approveMastercard(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.approveMastercard(id));
  }

  @Post('tenants/:id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspend a partner.' })
  async suspend(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.suspend(id));
  }

  @Post('tenants/:id/unsuspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lift a suspension.' })
  async unsuspend(@Param('id', SafeIdPipe) id: string) {
    return this.view(await this.admin.unsuspend(id));
  }

  // --- OAuth clients ---

  @Post('tenants/:id/clients')
  @ApiOperation({
    summary: 'Issue an OAuth client (client_secret shown once).',
  })
  @ApiResponse({ status: 201, type: IssuedClientDto })
  async issueClient(
    @Param('id', SafeIdPipe) id: string,
  ): Promise<IssuedClientDto> {
    const creds = await this.admin.issueClient(id);
    return plainToInstance(
      IssuedClientDto,
      {
        ...creds,
        note: 'client_secret показан один раз — сохраните его сейчас',
      },
      { excludeExtraneousValues: true },
    );
  }

  @Delete('clients/:clientId')
  @ApiOperation({ summary: 'Revoke an OAuth client.' })
  @ApiResponse({
    status: 404,
    description: 'Client not found / already revoked.',
  })
  async revokeClient(@Param('clientId', SafeIdPipe) clientId: string) {
    const res = await this.admin.revokeClient(clientId);
    // 404 for a nonexistent/already-revoked client — otherwise 200 {revoked:false}
    // is indistinguishable from a successful revoke (a typo in the id looks like success).
    if (!res.revoked) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }
    return res;
  }

  /**
   * Outward-facing partner representation. Whitelist via class-transformer:
   * `excludeExtraneousValues` copies ONLY the `@Expose` fields of TenantViewDto, so
   * `secretRef` (and any future entity column) will not appear in the response by
   * default — previously a manual `{ secretRef, ...pub }` was a blacklist and a new
   * sensitive column would have leaked through `...pub`.
   */
  private view(t: Tenant): TenantViewDto {
    return plainToInstance(
      TenantViewDto,
      { ...t, status: effectiveStatus(t) },
      { excludeExtraneousValues: true },
    );
  }
}
