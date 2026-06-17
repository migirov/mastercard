import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GatewayConfig } from '../../config/gateway-config';
import { matchSharedToken } from '../../common/utils/crypto.util';

/**
 * Authenticates inbound Mastercard webhooks IN THE SERVICE itself, not by trusting
 * the infrastructure (ingress/mTLS).
 *
 * Shared-token `X-Webhook-Token` — **fail-closed**: if the token is not configured
 * (`webhookToken` empty), webhook delivery is REJECTED (not let through "relying on
 * mTLS"). The token is mandatory in both dev and prod.
 *
 * There is no payload-signature check: MC does not sign push bodies — push
 * authenticity at Mastercard is mTLS (public mTLS cert from MC + trust + our cert
 * chain via the KMP portal), confirmed from the MC docs. mTLS at the ingress (if
 * present) is an extra network layer, NOT a replacement for in-service auth.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly config: GatewayConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const expected = this.config.webhookToken;

    // fail-closed: with no configured token we trust no one.
    if (!expected) {
      throw new UnauthorizedException(
        'webhook authentication is not configured',
      );
    }

    if (!matchSharedToken(req.headers['x-webhook-token'], expected)) {
      throw new UnauthorizedException('invalid webhook token');
    }
    return true;
  }
}
