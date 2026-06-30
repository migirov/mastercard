import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../../auth/decorators/current-tenant.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/gateway-validation.pipe';
import { StringQueryPipe } from '../../../common/pipes/string-query.pipe';
import { CrossBorderArea } from '../../common/decorators/cross-border-area.decorator';
import { AccountValidationRequestDto } from '../dto/account-validation-request.dto';
import { AddressValidationRequestDto } from '../dto/address-validation-request.dto';
import { BankLookupRequestDto } from '../dto/bank-lookup-request.dto';
import { IbanGenerationRequestDto } from '../dto/iban-generation-request.dto';
import { ValidationsService } from '../services/validations.service';

@Controller('crossborder')
@CrossBorderArea()
export class ValidationsController {
  constructor(private readonly svc: ValidationsService) {}

  @Post('address-validations')
  @HttpCode(200) // validation is a computation, not a resource creation
  @ApiOperation({
    summary:
      'Validate the recipient address before payment (MC Address Validation).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  validateAddress(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: AddressValidationRequestDto,
  ) {
    return this.svc.validateAddress(ctx.tenantId, body);
  }

  @Post('account-validations')
  @HttpCode(200) // validation is a computation, not a resource creation
  @ApiOperation({
    summary:
      'Validate the recipient account before payment (MC Account Validation).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  validateAccount(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: AccountValidationRequestDto,
  ) {
    return this.svc.validateAccount(ctx.tenantId, body);
  }

  @Post('bank-lookups')
  @HttpCode(200) // a lookup/computation, not a resource creation
  @ApiOperation({
    summary:
      "Look up the recipient bank's details (MC Bank Information Lookup).",
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  lookupBank(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: BankLookupRequestDto,
  ) {
    return this.svc.lookupBank(ctx.tenantId, body);
  }

  @Post('iban-generations')
  @HttpCode(200) // generates a value, not a resource in our system
  @ApiOperation({
    summary: 'Generate an IBAN from account details (MC IBAN Generation).',
  })
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  generateIban(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: IbanGenerationRequestDto,
  ) {
    return this.svc.generateIban(ctx.tenantId, body);
  }

  @Get('endpoint-guide/specifications')
  @ApiOperation({
    summary:
      'Endpoint Guide: corridor field requirements (MC Endpoint Guide, GET).',
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
}
