import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenant, TenantContext } from '../../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../../auth/guards/tenant-auth.guard';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { UseGatewayContract } from '../../common/decorators/gateway-contract.decorator';
import { SafeIdPipe } from '../../common/pipes/safe-id.pipe';
import { UuidParamPipe } from '../../common/pipes/uuid-param.pipe';
import { StringQueryPipe } from '../../common/pipes/string-query.pipe';
import { TenantThrottlerGuard } from '../../common/guards/tenant-throttler.guard';
import { AccountValidationRequestDto } from '../dto/account-validation-request.dto';
import { AddressValidationRequestDto } from '../dto/address-validation-request.dto';
import { BankLookupRequestDto } from '../dto/bank-lookup-request.dto';
import { ConfirmationRequestDto } from '../dto/confirmation-request.dto';
import { IbanGenerationRequestDto } from '../dto/iban-generation-request.dto';
import { mcPassthroughPipe } from '../../common/pipes/mc-passthrough.pipe';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { QuoteRequestDto } from '../dto/quote-request.dto';
import { RfiDocumentUploadRequestDto } from '../dto/rfi-document-upload-request.dto';
import { RfiUpdateRequestDto } from '../dto/rfi-update-request.dto';
import { StatusEventViewDto } from '../dto/status-event-view.dto';
import { CrossBorderService } from '../services/crossborder.service';

/**
 * Тенант берётся из аутентификации (OAuth2 Bearer для внешних мерчантов или
 * service-token для внутренних), а не из заголовка. Гард проставляет контекст.
 * Порядок гардов важен: сначала auth (ставит контекст), затем throttler
 * (лимит по tenantId).
 */
@ApiTags('cross-border')
@ApiBearerAuth('merchant')
@ApiSecurity('internal') // альтернативный путь: X-Internal-Token + X-Tenant-Id
@ApiHeader({
  name: 'X-Tenant-Id',
  required: false,
  description:
    'ID тенанта — ОБЯЗАТЕЛЕН при internal-аутентификации (X-Internal-Token).',
})
@ApiErrorResponses()
@ApiResponse({
  status: 502,
  type: ErrorResponseDto,
  description:
    'Ошибка связи с Mastercard / её ответ (или upstream-статус) скрыт.',
})
@Controller('crossborder')
@UseGuards(TenantAuthGuard, TenantThrottlerGuard)
@UseGatewayContract()
export class CrossBorderController {
  constructor(private readonly svc: CrossBorderService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Счета и балансы тенанта (passthrough из MC).' })
  balances(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getBalances(ctx.tenantId);
  }

  @Get('rates')
  @ApiOperation({
    summary:
      'Carded / FX Rate Pull: FX-курсы коридоров (MC getFxRates, GET без тела).',
  })
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

  @Post('address-validations')
  @HttpCode(200) // валидация — вычисление, не создание ресурса
  @ApiOperation({
    summary: 'Валидация адреса получателя до платежа (MC Address Validation).',
  })
  @UsePipes(mcPassthroughPipe())
  validateAddress(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: AddressValidationRequestDto,
  ) {
    return this.svc.validateAddress(ctx.tenantId, body);
  }

  @Post('account-validations')
  @HttpCode(200) // валидация — вычисление, не создание ресурса
  @ApiOperation({
    summary: 'Валидация счёта получателя до платежа (MC Account Validation).',
  })
  @UsePipes(mcPassthroughPipe())
  validateAccount(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: AccountValidationRequestDto,
  ) {
    return this.svc.validateAccount(ctx.tenantId, body);
  }

  @Post('bank-lookups')
  @HttpCode(200) // поиск/вычисление, не создание ресурса
  @ApiOperation({
    summary: 'Поиск реквизитов банка получателя (MC Bank Information Lookup).',
  })
  @UsePipes(mcPassthroughPipe())
  lookupBank(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: BankLookupRequestDto,
  ) {
    return this.svc.lookupBank(ctx.tenantId, body);
  }

  @Post('iban-generations')
  @HttpCode(200) // генерация значения, не создание ресурса в нашей системе
  @ApiOperation({
    summary: 'Генерация IBAN из реквизитов счёта (MC IBAN Generation).',
  })
  @UsePipes(mcPassthroughPipe())
  generateIban(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: IbanGenerationRequestDto,
  ) {
    return this.svc.generateIban(ctx.tenantId, body);
  }

  // --- Cash Pickup Locations (GET-каталоги; partner-id в заголовке) ---

  @Get('cash-pickup/countries')
  @ApiOperation({ summary: 'Cash Pickup: страны (фильтр cash_pickup_type).' })
  cashPickupCountries(
    @CurrentTenant() ctx: TenantContext,
    @Query('cash_pickup_type', StringQueryPipe) cashPickupType?: string,
  ) {
    return this.svc.cashPickupCountries(ctx.tenantId, cashPickupType);
  }

  @Get('cash-pickup/cities')
  @ApiOperation({ summary: 'Cash Pickup: города (Directed).' })
  cashPickupCities(
    @CurrentTenant() ctx: TenantContext,
    @Query('country', StringQueryPipe) country?: string,
    @Query('currency', StringQueryPipe) currency?: string,
    @Query('offset', StringQueryPipe) offset?: string,
    @Query('limit', StringQueryPipe) limit?: string,
  ) {
    return this.svc.cashPickupCities(ctx.tenantId, {
      country,
      currency,
      offset,
      limit,
    });
  }

  @Get('cash-pickup/providers')
  @ApiOperation({ summary: 'Cash Pickup: Receiving Service Providers.' })
  cashPickupProviders(
    @CurrentTenant() ctx: TenantContext,
    @Query('country', StringQueryPipe) country?: string,
    @Query('currency', StringQueryPipe) currency?: string,
    @Query('cash_pickup_type', StringQueryPipe) cashPickupType?: string,
    @Query('offset', StringQueryPipe) offset?: string,
    @Query('limit', StringQueryPipe) limit?: string,
  ) {
    return this.svc.cashPickupProviders(ctx.tenantId, {
      country,
      currency,
      cash_pickup_type: cashPickupType,
      offset,
      limit,
    });
  }

  @Get('cash-pickup/branches')
  @ApiOperation({ summary: 'Cash Pickup: точки выдачи провайдера.' })
  cashPickupBranches(
    @CurrentTenant() ctx: TenantContext,
    @Query('provider_id', StringQueryPipe) providerId?: string,
    @Query('state', StringQueryPipe) state?: string,
    @Query('city', StringQueryPipe) city?: string,
    @Query('offset', StringQueryPipe) offset?: string,
    @Query('limit', StringQueryPipe) limit?: string,
  ) {
    return this.svc.cashPickupBranches(ctx.tenantId, {
      provider_id: providerId,
      state,
      city,
      offset,
      limit,
    });
  }

  @Get('endpoint-guide/specifications')
  @ApiOperation({
    summary:
      'Endpoint Guide: требования к полям коридора (MC Endpoint Guide, GET).',
  })
  endpointGuide(
    @CurrentTenant() ctx: TenantContext,
    @Query('payment_type', StringQueryPipe) paymentType?: string,
    @Query('destination_country', StringQueryPipe) destinationCountry?: string,
    @Query('destination_currency', StringQueryPipe)
    destinationCurrency?: string,
    @Query('destination_payment_instrument', StringQueryPipe)
    destinationPaymentInstrument?: string,
  ) {
    return this.svc.endpointGuide(ctx.tenantId, {
      payment_type: paymentType,
      destination_country: destinationCountry,
      destination_currency: destinationCurrency,
      destination_payment_instrument: destinationPaymentInstrument,
    });
  }

  // --- RFI (Request for Information) ---

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
  @UsePipes(mcPassthroughPipe())
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
  @UsePipes(mcPassthroughPipe())
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

  @Post('quotes/cancellations')
  @HttpCode(200) // отмена — изменение состояния котировки, не создание
  @ApiOperation({
    summary:
      'Отмена подтверждённой котировки (transactionReference + proposalId).',
  })
  @UsePipes(mcPassthroughPipe())
  cancelConfirmedQuote(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: ConfirmationRequestDto,
  ) {
    return this.svc.cancelConfirmedQuote(ctx.tenantId, body);
  }

  @Get('quotes/:transactionReference/proposals/:proposalId')
  @ApiOperation({
    summary: 'Просмотр подтверждённой котировки (MC Retrieve Quote).',
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

  @Post('payments')
  // 201 (дефолт POST) намеренно: инициирование платежа СОЗДАёт ресурс-платёж в MC —
  // в отличие от compute/state-change POST'ов выше, помеченных @HttpCode(200).
  @ApiOperation({
    summary:
      'Инициировать платёж. Идемпотентность — по transaction_reference (ретрай с тем же ref → тот же результат без повторного вызова MC).',
  })
  @UsePipes(mcPassthroughPipe())
  payment(@CurrentTenant() ctx: TenantContext, @Body() body: PaymentRequestDto) {
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
