import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  CurrentTenant,
  TenantContext,
} from '../../../auth/decorators/current-tenant.decorator';
import { StringQueryPipe } from '../../../common/pipes/string-query.pipe';
import { CrossBorderArea } from '../../common/decorators/cross-border-area.decorator';
import { CashPickupService } from '../services/cash-pickup.service';

@Controller('crossborder')
@CrossBorderArea()
export class CashPickupController {
  constructor(private readonly svc: CashPickupService) {}

  @Get('cash-pickup/countries')
  @ApiOperation({
    summary: 'Cash Pickup: countries (cash_pickup_type filter).',
  })
  cashPickupCountries(
    @CurrentTenant() ctx: TenantContext,
    @Query('cash_pickup_type', StringQueryPipe) cashPickupType?: string,
  ) {
    return this.svc.cashPickupCountries(ctx.tenantId, cashPickupType);
  }

  @Get('cash-pickup/cities')
  @ApiOperation({ summary: 'Cash Pickup: cities (Directed).' })
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
  @ApiOperation({ summary: 'Cash Pickup: provider pickup branches.' })
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
}
