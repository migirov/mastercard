import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantModule } from '../tenants/tenant.module';
import { TransactionStatusModule } from './transaction-status.module';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookHandler } from './webhook.handler';
import { MastercardWebhookController } from './mastercard-webhook.controller';

@Module({
  imports: [AuditModule, TenantModule, TransactionStatusModule],
  providers: [WebhookAuthGuard, WebhookHandler],
  controllers: [MastercardWebhookController],
})
export class WebhooksModule {}
