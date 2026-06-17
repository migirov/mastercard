import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { MastercardClientModule } from '../mastercard/mastercard-client.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantThrottlerGuard } from '../common/tenant-throttler.guard';
import { TransactionStatusModule } from '../webhooks/transaction-status.module';
import { CrossBorderService } from './crossborder.service';
import { CrossBorderController } from './crossborder.controller';
import { PaymentIdempotencyEntity } from './payment-idempotency.entity';
import { PaymentIdempotencyStore } from './payment-idempotency.store';

@Module({
  imports: [
    TenantModule,
    CredentialsModule,
    MastercardClientModule,
    AuthModule,
    AuditModule,
    TransactionStatusModule,
    // Идемпотентность платежей — источник истины в Postgres (`payment_idempotency`),
    // а не в отдельном KV-слое.
    TypeOrmModule.forFeature([PaymentIdempotencyEntity]),
  ],
  // PaymentIdempotencyStore — приватный провайдер (единственный потребитель —
  // CrossBorderService).
  providers: [CrossBorderService, PaymentIdempotencyStore, TenantThrottlerGuard],
  controllers: [CrossBorderController],
  exports: [CrossBorderService],
})
export class CrossBorderModule {}
