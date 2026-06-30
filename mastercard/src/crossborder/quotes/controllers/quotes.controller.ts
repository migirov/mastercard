import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../../auth/decorators/current-tenant.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/gateway-validation.pipe';
import { SafeIdPipe } from '../../../common/pipes/safe-id.pipe';
import { CrossBorderArea } from '../../common/decorators/cross-border-area.decorator';
import { ConfirmationRequestDto } from '../dto/confirmation-request.dto';
import { QuoteRequestDto } from '../dto/quote-request.dto';
import { QuotesService } from '../services/quotes.service';

@Controller('crossborder')
@CrossBorderArea()
export class QuotesController {
  constructor(private readonly svc: QuotesService) {}

  @Post('quotes')
  @HttpCode(200) // a quote is a computation, not a resource creation
  @ApiOperation({
    summary: 'Request a quote. Body is passed through to MC (quoterequest).',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid format of critical fields.',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  quote(@CurrentTenant() ctx: TenantContext, @Body() body: QuoteRequestDto) {
    return this.svc.createQuote(ctx.tenantId, body);
  }

  @Post('quotes/confirmations')
  @HttpCode(200) // a confirmation changes the quote's state, not a creation
  @ApiOperation({
    summary: 'Confirm a quote (transactionReference + proposalId).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  confirmQuote(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: ConfirmationRequestDto,
  ) {
    return this.svc.confirmQuote(ctx.tenantId, body);
  }

  @Post('quotes/cancellations')
  @HttpCode(200) // a cancellation changes the quote's state, not a creation
  @ApiOperation({
    summary: 'Cancel a confirmed quote (transactionReference + proposalId).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  cancelConfirmedQuote(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: ConfirmationRequestDto,
  ) {
    return this.svc.cancelConfirmedQuote(ctx.tenantId, body);
  }

  @Get('quotes/:transactionReference/proposals/:proposalId')
  @ApiOperation({
    summary: 'Retrieve a confirmed quote (MC Retrieve Quote).',
  })
  retrieveConfirmedQuote(
    @CurrentTenant() ctx: TenantContext,
    @Param('transactionReference', SafeIdPipe) transactionReference: string,
    @Param('proposalId', SafeIdPipe) proposalId: string,
  ) {
    return this.svc.retrieveConfirmedQuote(
      ctx.tenantId,
      transactionReference,
      proposalId,
    );
  }
}
