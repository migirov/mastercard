import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TransactionOwnershipModule } from '../crossborder/common/ownership/transaction-ownership.module';
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
    // Lets the handler check an inbound push's unauthenticated `partnerId` against a local
    // claim. The check drives a WARN only — it deliberately does NOT change attribution;
    // see `WebhookHandler.attributeTenant` for why refusing to attribute would lose genuine
    // notifications for OWN tenants.
    TransactionOwnershipModule,
  ],
  providers: [WebhookAuthGuard, WebhookHandler],
  controllers: [MastercardWebhookController],
})
export class WebhooksModule {}
