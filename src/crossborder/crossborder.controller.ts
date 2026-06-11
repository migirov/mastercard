import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  CurrentTenant,
  TenantContext,
} from '../auth/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantThrottlerGuard } from '../common/tenant-throttler.guard';
import { ConfirmationRequestDto } from './dto/confirmation-request.dto';
import { mcPassthroughPipe } from './dto/mc-passthrough.pipe';
import { PaymentRequestDto } from './dto/payment-request.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { CrossBorderService } from './crossborder.service';

/**
 * Тенант берётся из аутентификации (OAuth2 Bearer для внешних мерчантов или
 * service-token для внутренних), а не из заголовка. Гард проставляет контекст.
 * Порядок гардов важен: сначала auth (ставит контекст), затем throttler
 * (лимит по tenantId).
 */
@Controller('crossborder')
@UseGuards(TenantAuthGuard, TenantThrottlerGuard)
export class CrossBorderController {
  constructor(private readonly svc: CrossBorderService) {}

  @Get('balances')
  balances(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getBalances(ctx.tenantId);
  }

  @Get('rates')
  rates(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getRates(ctx.tenantId);
  }

  @Post('quotes')
  @UsePipes(mcPassthroughPipe())
  quote(@CurrentTenant() ctx: TenantContext, @Body() body: QuoteRequestDto) {
    return this.svc.createQuote(ctx.tenantId, body);
  }

  @Post('quotes/confirmations')
  @UsePipes(mcPassthroughPipe())
  confirmQuote(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: ConfirmationRequestDto,
  ) {
    return this.svc.confirmQuote(ctx.tenantId, body);
  }

  @Post('payments')
  @UsePipes(mcPassthroughPipe())
  payment(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: PaymentRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.svc.createPayment(ctx.tenantId, body, idempotencyKey);
  }

  /** Поиск платежа по reference: GET /crossborder/payments?ref=... */
  @Get('payments')
  getPaymentByRef(
    @CurrentTenant() ctx: TenantContext,
    @Query('ref') ref: string,
  ) {
    return this.svc.getPaymentByRef(ctx.tenantId, ref);
  }

  @Get('payments/:id')
  getPayment(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.svc.getPayment(ctx.tenantId, id);
  }

  @Post('payments/:id/cancel')
  cancelPayment(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.svc.cancelPayment(ctx.tenantId, id);
  }
}
