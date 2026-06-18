import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { MastercardClientModule } from '../mastercard/mastercard-client.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantThrottlerGuard } from '../common/guards/tenant-throttler.guard';
import { TransactionStatusModule } from '../webhooks/transaction-status.module';
import { CrossBorderGateway } from './gateway/cross-border.gateway';
import { AccountsController } from './accounts/controllers/accounts.controller';
import { AccountsService } from './accounts/services/accounts.service';
import { QuotesController } from './quotes/controllers/quotes.controller';
import { QuotesService } from './quotes/services/quotes.service';
import { PaymentsController } from './payments/controllers/payments.controller';
import { PaymentsService } from './payments/services/payments.service';
import { ValidationsController } from './validations/controllers/validations.controller';
import { ValidationsService } from './validations/services/validations.service';
import { CashPickupController } from './cash-pickup/controllers/cash-pickup.controller';
import { CashPickupService } from './cash-pickup/services/cash-pickup.service';
import { RfiController } from './rfi/controllers/rfi.controller';
import { RfiService } from './rfi/services/rfi.service';
import { PaymentIdempotencyEntity } from './payments/entities/payment-idempotency.entity';
import { PaymentIdempotencyStore } from './payments/services/payment-idempotency.store';

/**
 * Cross-Border API. Split by API area (issue #16): one controller + service per
 * area (accounts/quotes/payments/validations/cash-pickup/rfi), all over a shared
 * `CrossBorderGateway` engine (tenant gating, the MC call + response unwrapping,
 * URL/header helpers). Nothing is exported — the areas are the module's surface.
 */
@Module({
  imports: [
    TenantModule,
    CredentialsModule,
    MastercardClientModule,
    AuthModule,
    AuditModule,
    TransactionStatusModule,
    // Payment idempotency — the source of truth is Postgres (`payment_idempotency`),
    // not a separate KV layer.
    TypeOrmModule.forFeature([PaymentIdempotencyEntity]),
  ],
  // PaymentIdempotencyStore — a private provider (the only consumer is PaymentsService).
  providers: [
    CrossBorderGateway,
    AccountsService,
    QuotesService,
    PaymentsService,
    ValidationsService,
    CashPickupService,
    RfiService,
    PaymentIdempotencyStore,
    TenantThrottlerGuard,
  ],
  controllers: [
    AccountsController,
    QuotesController,
    PaymentsController,
    ValidationsController,
    CashPickupController,
    RfiController,
  ],
})
export class CrossBorderModule {}
