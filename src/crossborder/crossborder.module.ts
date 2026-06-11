import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { MastercardClientModule } from '../mastercard/mastercard.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantThrottlerGuard } from '../common/tenant-throttler.guard';
import { CrossBorderService } from './crossborder.service';
import { CrossBorderController } from './crossborder.controller';

@Module({
  imports: [
    TenantModule,
    CredentialsModule,
    MastercardClientModule,
    AuthModule,
  ],
  // IdempotencyService — приватный провайдер (единственный потребитель —
  // CrossBorderService); работает поверх глобального KV_STORE.
  providers: [CrossBorderService, IdempotencyService, TenantThrottlerGuard],
  controllers: [CrossBorderController],
  exports: [CrossBorderService],
})
export class CrossBorderModule {}
