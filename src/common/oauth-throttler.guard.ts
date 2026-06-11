import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit `/oauth/token` по `client_id`, а НЕ по IP.
 *
 * Почему: за обратным прокси/LB все запросы приходят с одного IP — IP-лимит тогда
 * схлопывает всех клиентов в общий бакет (легальных throttлит друг за друга,
 * атакующего не изолирует). `client_id` — стабильная личность запроса: брутфорс
 * секрета конкретного клиента ограничен 10/мин и его НЕЛЬЗЯ обойти ротацией IP.
 * Если `client_id` не извлекается (кривой запрос) — фолбэк на IP.
 */
@Injectable()
export class OAuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const clientId = clientIdFrom(req);
    return clientId ? `cid:${clientId}` : `ip:${req.ip ?? 'unknown'}`;
  }
}

/** client_id — из тела (form/JSON) или из заголовка Basic (RFC 6749 §2.3.1). */
function clientIdFrom(req: Record<string, any>): string | undefined {
  const fromBody = req.body?.client_id;
  if (typeof fromBody === 'string' && fromBody) {
    return fromBody;
  }
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i > 0) {
        return decoded.slice(0, i);
      }
    } catch {
      /* битый base64 — фолбэк на IP */
    }
  }
  return undefined;
}
