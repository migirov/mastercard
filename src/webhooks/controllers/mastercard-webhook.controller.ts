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
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { UseGatewayContract } from '../../common/decorators/gateway-contract.decorator';
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../common/pipes/gateway-validation.pipe';
import { McWebhookEventDto } from '../dto/mc-webhook-event.dto';
import { WebhookAckDto } from '../dto/webhook-ack.dto';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';
import { WebhookHandler } from '../services/webhook.handler';

/**
 * Receives Mastercard push notifications. Always responds 200 (per the docs — otherwise MC
 * retries). The body is validated with the Passthrough preset of the shared validation
 * strategy: MC sends many fields beyond those declared — they must not be stripped or
 * rejected. Encrypted payloads (optional) are decrypted in Phase 4.
 *
 * The throttler runs AFTER WebhookAuthGuard (it limits only token-valid requests; an
 * invalid token → 401 BEFORE the throttler, spending no budget) — a backstop against a
 * token holder flooding DB writes. The limit is deliberately GENEROUS: legitimate MC bursts
 * (multi-merchant, retries) must not hit 429 (and a 429 would itself provoke an MC retry).
 * By IP: all MC traffic comes from a few IPs.
 * NOTE: the limit is PER-POD (in-memory throttler, Redis is not used in this project) —
 * the aggregate ceiling = 1200×N pods. This is a backstop, NOT a global hard cap.
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
    summary: 'Receive MC push notifications (X-Webhook-Token, fail-closed).',
  })
  @ApiResponse({ status: 200, type: WebhookAckDto })
  @HttpCode(200)
  @UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))
  receive(@Body() event: McWebhookEventDto): Promise<WebhookAckDto> {
    return this.handler.handle(event);
  }
}
