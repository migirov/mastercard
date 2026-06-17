import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { MastercardClientModule } from '../mastercard/mastercard-client.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantThrottlerGuard } from '../common/guards/tenant-throttler.guard';
import { TransactionStatusModule } from '../webhooks/transaction-status.module';
import { CrossBorderService } from './services/crossborder.service';
import { CrossBorderController } from './controllers/crossborder.controller';
import { PaymentIdempotencyEntity } from './entities/payment-idempotency.entity';
import { PaymentIdempotencyStore } from './services/payment-idempotency.store';

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
  // PaymentIdempotencyStore — a private provider (the only consumer is CrossBorderService).
  providers: [
    CrossBorderService,
    PaymentIdempotencyStore,
    TenantThrottlerGuard,
  ],
  controllers: [CrossBorderController],
  exports: [CrossBorderService],
})
export class CrossBorderModule {}
