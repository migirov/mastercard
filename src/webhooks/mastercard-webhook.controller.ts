import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';
import { UseGatewayContract } from '../common/gateway-contract.decorator';
import { mcPassthroughPipe } from '../common/mc-passthrough.pipe';
import { McWebhookEventDto } from './dto/mc-webhook-event.dto';
import { WebhookAckDto } from './dto/webhook-ack.dto';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookHandler } from './webhook.handler';

/**
 * Приём push-уведомлений Mastercard. Всегда отвечаем 200 (по докам — иначе MC
 * ретраит). Тело валидируется passthrough-pipe: MC шлёт много полей сверх
 * объявленных — их нельзя вырезать/отвергать. Зашифрованные payload-ы (опц.)
 * расшифруем в Фазе 4.
 *
 * Throttler стоит ПОСЛЕ WebhookAuthGuard (лимитирует только токен-валидные
 * запросы; невалидный токен → 401 ДО throttler, не тратит бюджет) — backstop
 * против флуда DB-записей держателем токена. Лимит намеренно ЩЕДРЫЙ: легитимные
 * MC-всплески (мультимерчант, ретраи) не должны ловить 429 (а 429 ещё и
 * спровоцировал бы MC-ретрай). По IP: вся MC-нагрузка с немногих IP.
 * ⚠️ Лимит PER-POD (in-memory throttler, Redis в проекте не используем) —
 * совокупный потолок = 1200×N подов. Это backstop, а НЕ глобальный жёсткий кап.
 */
@ApiTags('webhooks')
@ApiSecurity('webhook')
@ApiErrorResponses()
@Controller('webhooks')
@UseGuards(WebhookAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 1200, ttl: 60_000 } })
@UseGatewayContract()
export class MastercardWebhookController {
  constructor(private readonly handler: WebhookHandler) {}

  @Post('mastercard')
  @ApiOperation({
    summary: 'Приём push-уведомлений MC (X-Webhook-Token, fail-closed).',
  })
  @ApiResponse({ status: 200, type: WebhookAckDto })
  @HttpCode(200)
  @UsePipes(mcPassthroughPipe())
  receive(@Body() event: McWebhookEventDto): Promise<WebhookAckDto> {
    return this.handler.handle(event);
  }
}
