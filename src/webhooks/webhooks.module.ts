import { Module } from '@nestjs/common';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookHandler } from './webhook.handler';
import { MastercardWebhookController } from './mastercard-webhook.controller';

@Module({
  providers: [WebhookAuthGuard, WebhookHandler],
  controllers: [MastercardWebhookController],
})
export class WebhooksModule {}
