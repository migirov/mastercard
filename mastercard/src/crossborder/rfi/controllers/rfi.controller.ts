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
} from '../../../auth/decorators/current-tenant.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/gateway-validation.pipe';
import { UuidParamPipe } from '../../../common/pipes/uuid-param.pipe';
import { CrossBorderArea } from '../../common/decorators/cross-border-area.decorator';
import { RfiDocumentUploadRequestDto } from '../dto/rfi-document-upload-request.dto';
import { RfiUpdateRequestDto } from '../dto/rfi-update-request.dto';
import { RfiService } from '../services/rfi.service';

@Controller('crossborder')
@CrossBorderArea()
export class RfiController {
  constructor(private readonly svc: RfiService) {}

  @Get('rfi/requests/:requestId')
  @ApiOperation({
    summary: 'RFI: retrieve the request state (MC Retrieve RFI).',
  })
  @ApiParam({
    name: 'requestId',
    format: 'uuid',
    description: 'RFI request_id — a valid UUID (RFC-4122).',
  })
  retrieveRfi(
    @CurrentTenant() ctx: TenantContext,
    @Param('requestId', UuidParamPipe) requestId: string,
  ) {
    return this.svc.retrieveRfi(ctx.tenantId, requestId);
  }

  @Post('rfi/requests/:requestId')
  @HttpCode(200) // answering the request changes the RFI's state, not a creation
  @ApiOperation({
    summary: 'RFI: submit the Customer response (MC Update RFI).',
  })
  @ApiParam({
    name: 'requestId',
    format: 'uuid',
    description: 'RFI request_id — a valid UUID (RFC-4122).',
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
    summary: 'RFI: upload a document <1MB (MC Upload Document).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  uploadRfiDocument(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: RfiDocumentUploadRequestDto,
  ) {
    return this.svc.uploadRfiDocument(ctx.tenantId, body);
  }

  @Get('rfi/documents/:documentId')
  @ApiOperation({ summary: 'RFI: download a document (MC Download Document).' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'RFI document_id — a valid UUID (RFC-4122).',
  })
  downloadRfiDocument(
    @CurrentTenant() ctx: TenantContext,
    @Param('documentId', UuidParamPipe) documentId: string,
  ) {
    return this.svc.downloadRfiDocument(ctx.tenantId, documentId);
  }
}
