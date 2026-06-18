import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../auth/decorators/current-tenant.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../common/pipes/gateway-validation.pipe';
import { UuidParamPipe } from '../../common/pipes/uuid-param.pipe';
import { CrossBorderArea } from '../decorators/cross-border-area.decorator';
import { RfiDocumentUploadRequestDto } from '../dto/rfi-document-upload-request.dto';
import { RfiUpdateRequestDto } from '../dto/rfi-update-request.dto';
import { RfiService } from './rfi.service';

@Controller('crossborder')
@CrossBorderArea()
export class RfiController {
  constructor(private readonly svc: RfiService) {}

  @Get('rfi/requests/:requestId')
  @ApiOperation({
    summary: 'RFI: получить состояние запроса (MC Retrieve RFI).',
  })
  @ApiParam({
    name: 'requestId',
    format: 'uuid',
    description: 'RFI request_id — валидный UUID (RFC-4122).',
  })
  retrieveRfi(
    @CurrentTenant() ctx: TenantContext,
    @Param('requestId', UuidParamPipe) requestId: string,
  ) {
    return this.svc.retrieveRfi(ctx.tenantId, requestId);
  }

  @Post('rfi/requests/:requestId')
  @HttpCode(200) // ответ на запрос — изменение состояния RFI, не создание
  @ApiOperation({ summary: 'RFI: отправить ответ Customer (MC Update RFI).' })
  @ApiParam({
    name: 'requestId',
    format: 'uuid',
    description: 'RFI request_id — валидный UUID (RFC-4122).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  updateRfi(
    @CurrentTenant() ctx: TenantContext,
    @Param('requestId', UuidParamPipe) requestId: string,
    @Body() body: RfiUpdateRequestDto,
  ) {
    return this.svc.updateRfi(ctx.tenantId, requestId, body);
  }

  @Post('rfi/documents')
  @ApiOperation({
    summary: 'RFI: загрузить документ <1MB (MC Upload Document).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  uploadRfiDocument(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: RfiDocumentUploadRequestDto,
  ) {
    return this.svc.uploadRfiDocument(ctx.tenantId, body);
  }

  @Get('rfi/documents/:documentId')
  @ApiOperation({ summary: 'RFI: скачать документ (MC Download Document).' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'RFI document_id — валидный UUID (RFC-4122).',
  })
  downloadRfiDocument(
    @CurrentTenant() ctx: TenantContext,
    @Param('documentId', UuidParamPipe) documentId: string,
  ) {
    return this.svc.downloadRfiDocument(ctx.tenantId, documentId);
  }
}
