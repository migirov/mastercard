import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../auth/decorators/current-tenant.decorator';
import { CrossBorderArea } from '../decorators/cross-border-area.decorator';
import { AccountsService } from './accounts.service';

@Controller('crossborder')
@CrossBorderArea()
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

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
}
