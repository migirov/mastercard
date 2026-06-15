import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GatewayConfig } from '../config/gateway-config';
import { safeTokenEqual } from '../common/crypto.util';
import { WebhookSignatureVerifier } from './webhook-signature.verifier';

/**
 * Аутентификация входящих вебхуков Mastercard — В САМОМ СЕРВИСЕ, а не за счёт
 * доверия к инфраструктуре (ингресс/mTLS).
 *
 * Два фактора:
 *   1) shared-token `X-Webhook-Token` — **fail-closed**: если токен не настроен
 *      (`webhookToken` пуст), приём ВЕБХУКОВ ОТКЛОНЯЕТСЯ (а не пропускается «в
 *      расчёте на mTLS»). Токен обязателен и в dev, и в prod.
 *   2) подпись MC по сырому телу — `WebhookSignatureVerifier`. Сейчас заглушка
 *      (ждём спецификацию подписи MC, вопрос C1); включается без правок здесь.
 *
 * mTLS на ингрессе (если есть) — дополнительный сетевой слой, но НЕ замена
 * аутентификации в приложении.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(
    private readonly config: GatewayConfig,
    private readonly signature: WebhookSignatureVerifier,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const expected = this.config.webhookToken;

    // fail-closed: без настроенного токена не доверяем никому.
    if (!expected) {
      throw new UnauthorizedException(
        'webhook authentication is not configured',
      );
    }

    const token = req.headers['x-webhook-token'];
    if (!token || !safeTokenEqual(String(token), expected)) {
      throw new UnauthorizedException('invalid webhook token');
    }

    // Второй фактор — криптоподпись MC по сырому телу (заглушка до C1).
    if (!this.signature.verify(req.headers ?? {}, req.rawBody)) {
      throw new UnauthorizedException('invalid webhook signature');
    }
    return true;
  }
}
