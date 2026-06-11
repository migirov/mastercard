import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MastercardModule } from '../mastercard/mastercard.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantThrottlerGuard } from '../common/tenant-throttler.guard';
import { CrossBorderService } from './crossborder.service';
import { CrossBorderController } from './crossborder.controller';

@Module({
  imports: [
    TenantModule,
    CredentialsModule,
    MastercardModule,
    IdempotencyModule,
    AuthModule,
  ],
  providers: [CrossBorderService, TenantThrottlerGuard],
  controllers: [CrossBorderController],
  exports: [CrossBorderService],
})
export class CrossBorderModule {}
