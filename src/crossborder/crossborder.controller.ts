import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenant, TenantContext } from '../auth/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { GatewayExceptionFilter } from '../common/gateway-exception.filter';
import { IdempotencyKey } from '../common/idempotency-key.decorator';
import { IdempotencyKeyPipe } from '../common/idempotency-key.pipe';
import { SafeIdPipe } from '../common/safe-id.pipe';
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
@ApiTags('cross-border')
@ApiBearerAuth('merchant')
@ApiResponse({
  status: 403,
  type: ErrorResponseDto,
  description: 'Тенант не ACTIVE (нет двойного одобрения).',
})
@ApiResponse({
  status: 502,
  type: ErrorResponseDto,
  description: 'Ошибка связи с Mastercard / её ответ скрыт.',
})
@Controller('crossborder')
@UseGuards(TenantAuthGuard, TenantThrottlerGuard)
@UseFilters(GatewayExceptionFilter)
export class CrossBorderController {
  constructor(private readonly svc: CrossBorderService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Счета и балансы тенанта (passthrough из MC).' })
  balances(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getBalances(ctx.tenantId);
  }

  @Get('rates')
  @ApiOperation({ summary: 'Доступные FX-курсы (passthrough из MC).' })
  rates(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getRates(ctx.tenantId);
  }

  @Post('quotes')
  @HttpCode(200) // котировка — вычисление, не создание ресурса
  @ApiOperation({
    summary: 'Запрос котировки. Тело проброса в MC (quoterequest).',
  })
  @ApiResponse({
    status: 400,
    description: 'Невалидный формат критичных полей.',
  })
  @UsePipes(mcPassthroughPipe())
  quote(@CurrentTenant() ctx: TenantContext, @Body() body: QuoteRequestDto) {
    return this.svc.createQuote(ctx.tenantId, body);
  }

  @Post('quotes/confirmations')
  @HttpCode(200) // подтверждение — изменение состояния котировки, не создание
  @ApiOperation({
    summary: 'Подтверждение котировки (transactionReference + proposalId).',
  })
  @UsePipes(mcPassthroughPipe())
  confirmQuote(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: ConfirmationRequestDto,
  ) {
    return this.svc.confirmQuote(ctx.tenantId, body);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Инициировать платёж. Idempotency-Key опционален.' })
  @UsePipes(mcPassthroughPipe())
  payment(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: PaymentRequestDto,
    @IdempotencyKey(IdempotencyKeyPipe) idempotencyKey?: string,
  ) {
    return this.svc.createPayment(ctx.tenantId, body, idempotencyKey);
  }

  /** Поиск платежа по reference: GET /crossborder/payments?ref=... */
  @Get('payments')
  @ApiOperation({ summary: 'Статус платежа по transaction_reference (?ref=).' })
  getPaymentByRef(
    @CurrentTenant() ctx: TenantContext,
    @Query('ref', SafeIdPipe) ref: string,
  ) {
    return this.svc.getPaymentByRef(ctx.tenantId, ref);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Статус платежа по id.' })
  getPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.getPayment(ctx.tenantId, id);
  }

  @Post('payments/:id/cancel')
  @ApiOperation({ summary: 'Отмена платежа по id.' })
  cancelPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.cancelPayment(ctx.tenantId, id);
  }
}
