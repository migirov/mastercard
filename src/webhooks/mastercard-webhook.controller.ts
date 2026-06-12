import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { mcPassthroughPipe } from '../crossborder/dto/mc-passthrough.pipe';
import { GatewayExceptionFilter } from '../common/gateway-exception.filter';
import { McWebhookEventDto } from './dto/mc-webhook-event.dto';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookHandler } from './webhook.handler';

/**
 * Приём push-уведомлений Mastercard. Всегда отвечаем 200 (по докам — иначе MC
 * ретраит). Тело валидируется passthrough-pipe: MC шлёт много полей сверх
 * объявленных — их нельзя вырезать/отвергать. Зашифрованные payload-ы (опц.)
 * расшифруем в Фазе 4.
 */
@ApiTags('webhooks')
@ApiSecurity('webhook')
@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
@UseFilters(GatewayExceptionFilter)
@UseInterceptors(AuditInterceptor)
export class MastercardWebhookController {
  constructor(private readonly handler: WebhookHandler) {}

  @Post('mastercard')
  @ApiOperation({
    summary: 'Приём push-уведомлений MC (X-Webhook-Token, fail-closed).',
  })
  @HttpCode(200)
  @UsePipes(mcPassthroughPipe())
  receive(@Body() event: McWebhookEventDto) {
    return this.handler.handle(event);
  }
}
