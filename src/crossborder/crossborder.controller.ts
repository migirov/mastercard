import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentTenant,
  TenantContext,
} from '../auth/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantThrottlerGuard } from '../common/tenant-throttler.guard';
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
  quote(@CurrentTenant() ctx: TenantContext, @Body() body: unknown) {
    return this.svc.createQuote(ctx.tenantId, body);
  }

  @Post('quotes/confirmations')
  confirmQuote(@CurrentTenant() ctx: TenantContext, @Body() body: unknown) {
    return this.svc.confirmQuote(ctx.tenantId, body);
  }

  @Post('payments')
  payment(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: unknown,
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
