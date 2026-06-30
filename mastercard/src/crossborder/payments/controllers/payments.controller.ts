import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
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
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { StatusEventViewDto } from '../dto/status-event-view.dto';
import { PaymentsService } from '../services/payments.service';

@Controller('crossborder')
@CrossBorderArea()
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post('payments')
  // 201 (the POST default) is intentional: initiating a payment CREATES a payment
  // resource in MC — unlike the compute/state-change POSTs above marked @HttpCode(200).
  @ApiOperation({
    summary:
      'Initiate a payment. Idempotency is keyed on transaction_reference (a retry with the same ref → the same result without re-calling MC).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  payment(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: PaymentRequestDto,
  ) {
    return this.svc.createPayment(ctx.tenantId, body);
  }

  /** Look up a payment by reference: GET /crossborder/payments?ref=... */
  @Get('payments')
  @ApiOperation({
    summary: 'Payment status by transaction_reference (lookup, not a list).',
  })
  @ApiQuery({
    name: 'ref',
    required: true,
    description: 'transaction_reference.',
  })
  getPaymentByRef(
    @CurrentTenant() ctx: TenantContext,
    @Query('ref', SafeIdPipe) ref: string,
  ) {
    return this.svc.getPaymentByRef(ctx.tenantId, ref);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Payment status by id.' })
  getPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.getPayment(ctx.tenantId, id);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200) // cancellation changes the payment's state, not a resource creation
  @ApiOperation({ summary: 'Cancel a payment by id.' })
  cancelPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.cancelPayment(ctx.tenantId, id);
  }

  @Get('status-events')
  @ApiOperation({
    summary:
      'Stored push statuses by transaction_reference (Status Change Push delivered via polling).',
  })
  @ApiQuery({
    name: 'ref',
    required: true,
    description: 'transaction_reference of the transaction/quote.',
  })
  @ApiResponse({ status: 200, type: [StatusEventViewDto] })
  getStatusEvents(
    @CurrentTenant() ctx: TenantContext,
    @Query('ref', SafeIdPipe) ref: string,
  ) {
    // Pass the whole tenant: the service needs credentialMode for isolation (OWN
    // does not read the shared PLATFORM pool). The mode is already in the auth
    // context — no DB query needed.
    return this.svc.getStatusEvents(ctx.tenant, ref);
  }
}
