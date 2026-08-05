import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../../auth/decorators/current-tenant.decorator';
import { CrossBorderArea } from '../../common/decorators/cross-border-area.decorator';
import { AccountsService } from '../services/accounts.service';

@Controller('crossborder')
@CrossBorderArea()
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get('balances')
  @ApiOperation({
    summary: 'Tenant accounts and balances (passthrough from MC).',
    description:
      'Not available on the PSD2 edges (*.xbs.mastercard.eu|uk): Mastercard serves ' +
      'the Balance API there through the interactive OAuth2 Authorization Code flow, ' +
      'which this gateway does not implement. Balances also apply only to the ' +
      'Prefunding and Collateral settlement models.',
  })
  @ApiResponse({
    status: 501,
    description:
      'The deployment targets a PSD2 edge, where this endpoint is not implemented.',
  })
  balances(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getBalances(ctx.tenantId);
  }

  @Get('rates')
  @ApiOperation({
    summary:
      'Carded / FX Rate Pull: corridor FX rates (MC getFxRates, GET without a body).',
  })
  rates(@CurrentTenant() ctx: TenantContext) {
    return this.svc.getRates(ctx.tenantId);
  }
}
