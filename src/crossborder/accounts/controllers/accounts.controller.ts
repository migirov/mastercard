import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
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
