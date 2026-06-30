import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MastercardClientModule } from '../mastercard/mastercard-client.module';
import { TenantModule } from '../tenants/tenant.module';
import { TransactionStatusModule } from './transaction-status.module';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { WebhookHandler } from './services/webhook.handler';
import { MastercardWebhookController } from './controllers/mastercard-webhook.controller';

@Module({
  imports: [
    AuditModule,
    MastercardClientModule,
    TenantModule,
    TransactionStatusModule,
  ],
  providers: [WebhookAuthGuard, WebhookHandler],
  controllers: [MastercardWebhookController],
})
export class WebhooksModule {}
