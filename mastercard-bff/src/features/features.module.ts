import { Module } from '@nestjs/common';
import { GatewayClient } from '../xbs/common/gateway/gateway.client';

import { BankLookupController } from './bank-lookup/controllers/bank-lookup.controller';
import { BankLookupService } from './bank-lookup/services/bank-lookup.service';
import { IbanController } from './iban/controllers/iban.controller';
import { IbanService } from './iban/services/iban.service';
import { CashPickupController } from './cash-pickup/controllers/cash-pickup.controller';
import { CashPickupService } from './cash-pickup/services/cash-pickup.service';
import { RatesController } from './rates/controllers/rates.controller';
import { RatesService } from './rates/services/rates.service';
import { EndpointGuideController } from './endpoint-guide/controllers/endpoint-guide.controller';
import { EndpointGuideService } from './endpoint-guide/services/endpoint-guide.service';
import { QuoteLifecycleController } from './quote-lifecycle/controllers/quote-lifecycle.controller';
import { QuoteLifecycleService } from './quote-lifecycle/services/quote-lifecycle.service';
import { PaymentTrackerController } from './payment-tracker/controllers/payment-tracker.controller';
import { PaymentTrackerService } from './payment-tracker/services/payment-tracker.service';
import { RfiController } from './rfi/controllers/rfi.controller';
import { RfiService } from './rfi/services/rfi.service';

/**
 * "Features" — the gateway cross-border APIs the original frontend never surfaced, each
 * exposed under `/features/*` and switched independently between live and demo
 * (`McConfig.featureMode`). Same architecture as `XbsModule`: one controller + service
 * per area over the shared `GatewayClient` (axios to the sibling gateway, used only in
 * `live` mode), with graceful demo fallback on any live miss.
 *
 * Live-by-default (real MC sandbox data today): bank-lookup, iban, cash-pickup.
 * Demo-by-default (sandbox-limited; flip via env when MC opens them): rates,
 * endpoint-guide, quote-lifecycle, payment-tracker, rfi.
 */
@Module({
  controllers: [
    BankLookupController,
    IbanController,
    CashPickupController,
    RatesController,
    EndpointGuideController,
    QuoteLifecycleController,
    PaymentTrackerController,
    RfiController,
  ],
  providers: [
    GatewayClient,
    BankLookupService,
    IbanService,
    CashPickupService,
    RatesService,
    EndpointGuideService,
    QuoteLifecycleService,
    PaymentTrackerService,
    RfiService,
  ],
})
export class FeaturesModule {}
