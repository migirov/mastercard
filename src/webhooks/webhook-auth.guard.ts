import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeEqual, sha256hex } from '../common/crypto.util';

/**
 * Аутентификация входящих вебхуков Mastercard.
 *
 * АВТОРИТЕТНО (по докам MC): push-уведомления идут по **mTLS** — взаимная TLS-
 * аутентификация, которая терминируется на ингрессе/LB (там валидируется
 * клиентский сертификат Mastercard). На уровне приложения это уже доверенное
 * соединение.
 *
 * Здесь — лишь app-уровневая dev-заглушка (shared secret X-Webhook-Token), чтобы
 * можно было тестировать локально без mTLS. В production основная защита = mTLS.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebhookAuthGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const expected = this.config.get<string>('MC_WEBHOOK_TOKEN');
    const isProd =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production';

    if (!expected) {
      // В проде защита — mTLS на ингрессе; здесь не блокируем, но предупреждаем.
      if (!isProd) return true;
      this.logger.warn(
        'MC_WEBHOOK_TOKEN не задан — полагаемся на mTLS на ингрессе',
      );
      return true;
    }

    const token = req.headers['x-webhook-token'];
    if (!token || !safeEqual(sha256hex(String(token)), sha256hex(expected))) {
      throw new UnauthorizedException('invalid webhook token');
    }
    return true;
  }
}
