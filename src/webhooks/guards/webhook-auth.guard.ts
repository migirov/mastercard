import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TLSSocket } from 'tls';
import { GatewayConfig } from '../../config/gateway-config';
import { matchSharedToken } from '../../common/utils/crypto.util';

/**
 * Authenticates inbound Mastercard webhooks IN THE SERVICE itself, never by trusting the
 * infrastructure (ingress).
 *
 * Primary factor (prod): **in-app mTLS** — MC authenticates push only by a client certificate
 * (it sends no token/header/api-key, per the MC docs). When `webhookMtlsEnabled`, the app's own
 * HTTPS server requests the client cert (`requestCert`) and this guard validates it: the chain
 * must be trusted (`socket.authorized`) AND the subject CN must be in the allowlist (MC's
 * `CrossborderServicesNotification-{env}.mastercard.com`). The ingress, if any, is a dumb L4
 * TLS passthrough — it makes no trust decision, so security does not depend on it.
 *
 * Fallback factor (dev/local, no in-app TLS): the fail-closed shared `X-Webhook-Token` — if the
 * token is not configured, delivery is REJECTED (we trust no one).
 *
 * There is no payload-signature check: MC does not sign push bodies.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly config: GatewayConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    return this.config.webhookMtlsEnabled
      ? this.assertClientCert(req)
      : this.assertSharedToken(req);
  }

  /** In-app validation of MC's mTLS client certificate (terminated by our HTTPS server). */
  private assertClientCert(req: Request): boolean {
    const socket = req.socket as Partial<TLSSocket>;
    // No getPeerCertificate ⇒ TLS was terminated upstream (or this is plain HTTP) ⇒ we cannot
    // see the client cert ⇒ fail-closed. The whole point is to NOT delegate this to the ingress.
    if (typeof socket?.getPeerCertificate !== 'function') {
      throw new UnauthorizedException(
        'webhook mTLS is required but TLS is not terminated by the application',
      );
    }
    // `authorized` is true only when the presented client cert chains to a configured trusted CA.
    if (!socket.authorized) {
      throw new UnauthorizedException('client certificate is not trusted');
    }
    // CN is typed `string | string[]`; accept only a single string (fail-closed otherwise).
    const subjectCN = socket.getPeerCertificate().subject?.CN;
    const cn = typeof subjectCN === 'string' ? subjectCN : undefined;
    if (!cn || !this.config.webhookAllowedClientCNs.includes(cn)) {
      throw new UnauthorizedException('client certificate is not authorized');
    }
    return true;
  }

  /** Fail-closed shared-token check (dev/local fallback when in-app mTLS is off). */
  private assertSharedToken(req: Request): boolean {
    const expected = this.config.webhookToken;
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
