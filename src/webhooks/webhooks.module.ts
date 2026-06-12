import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookHandler } from './webhook.handler';
import { MastercardWebhookController } from './mastercard-webhook.controller';
import {
  NoopSignatureVerifier,
  WebhookSignatureVerifier,
} from './webhook-signature.verifier';

@Module({
  imports: [AuditModule],
  providers: [
    WebhookAuthGuard,
    WebhookHandler,
    // Подпись вебхука: пока заглушка (ждём спецификацию MC, C1). Заменив useClass,
    // включаем реальную JWS/HMAC-проверку без правок guard'а.
    { provide: WebhookSignatureVerifier, useClass: NoopSignatureVerifier },
  ],
  controllers: [MastercardWebhookController],
})
export class WebhooksModule {}
