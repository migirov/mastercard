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
} from '../../auth/decorators/current-tenant.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../common/pipes/gateway-validation.pipe';
import { SafeIdPipe } from '../../common/pipes/safe-id.pipe';
import { CrossBorderArea } from '../decorators/cross-border-area.decorator';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { StatusEventViewDto } from '../dto/status-event-view.dto';
import { PaymentsService } from './payments.service';

@Controller('crossborder')
@CrossBorderArea()
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post('payments')
  // 201 (дефолт POST) намеренно: инициирование платежа СОЗДАёт ресурс-платёж в MC —
  // в отличие от compute/state-change POST'ов выше, помеченных @HttpCode(200).
  @ApiOperation({
    summary:
      'Инициировать платёж. Идемпотентность — по transaction_reference (ретрай с тем же ref → тот же результат без повторного вызова MC).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  payment(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: PaymentRequestDto,
  ) {
    return this.svc.createPayment(ctx.tenantId, body);
  }

  /** Поиск платежа по reference: GET /crossborder/payments?ref=... */
  @Get('payments')
  @ApiOperation({
    summary: 'Статус платежа по transaction_reference (lookup, не список).',
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
  @ApiOperation({ summary: 'Статус платежа по id.' })
  getPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.getPayment(ctx.tenantId, id);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200) // отмена — смена состояния платежа, не создание ресурса
  @ApiOperation({ summary: 'Отмена платежа по id.' })
  cancelPayment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', SafeIdPipe) id: string,
  ) {
    return this.svc.cancelPayment(ctx.tenantId, id);
  }

  @Get('status-events')
  @ApiOperation({
    summary:
      'Сохранённые push-статусы по transaction_reference (доставка Status Change Push через polling).',
  })
  @ApiQuery({
    name: 'ref',
    required: true,
    description: 'transaction_reference транзакции/котировки.',
  })
  @ApiResponse({ status: 200, type: [StatusEventViewDto] })
  getStatusEvents(
    @CurrentTenant() ctx: TenantContext,
    @Query('ref', SafeIdPipe) ref: string,
  ) {
    // Передаём весь tenant: сервису нужен credentialMode для изоляции (OWN не
    // читает общий PLATFORM-пул). mode уже в auth-контексте — без запроса к БД.
    return this.svc.getStatusEvents(ctx.tenant, ref);
  }
}
