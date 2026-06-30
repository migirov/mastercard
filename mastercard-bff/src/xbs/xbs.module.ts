import { Module } from '@nestjs/common';
import { GatewayClient } from './common/gateway/gateway.client';
import { QuotesController } from './quotes/controllers/quotes.controller';
import { QuotesService } from './quotes/services/quotes.service';
import { ValidationsController } from './validations/controllers/validations.controller';
import { ValidationsService } from './validations/services/validations.service';
import { BalancesController } from './balances/controllers/balances.controller';
import { BalancesService } from './balances/services/balances.service';
import { PaymentsController } from './payments/controllers/payments.controller';
import { PaymentsService } from './payments/services/payments.service';
import { StatusController } from './status/controllers/status.controller';
import { StatusService } from './status/services/status.service';

/**
 * Cross-border (XBS) proxy. Split by API area (quotes / validations / balances /
 * payments / status), mirroring the gateway's `crossborder/` per-area layout. Each
 * area has its own controller + service; all share the `GatewayClient` (axios to the
 * sibling gateway, used only in `live` mode) and the typed `McConfig` (global).
 * Every area service falls back to demo synthesis on any live-call failure.
 */
@Module({
  controllers: [
    QuotesController,
    ValidationsController,
    BalancesController,
    PaymentsController,
    StatusController,
  ],
  providers: [
    GatewayClient,
    QuotesService,
    ValidationsService,
    BalancesService,
    PaymentsService,
    StatusService,
  ],
})
export class XbsModule {}
