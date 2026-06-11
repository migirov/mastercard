import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { McWebhookEvent, WebhookHandler } from './webhook.handler';

/**
 * Приём push-уведомлений Mastercard. Всегда отвечаем 200 (по докам — иначе MC
 * ретраит). Зашифрованные payload-ы (опц.) расшифруем в Фазе 4.
 */
@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
export class MastercardWebhookController {
  constructor(private readonly handler: WebhookHandler) {}

  @Post('mastercard')
  @HttpCode(200)
  receive(@Body() event: McWebhookEvent) {
    return this.handler.handle(event);
  }
}
