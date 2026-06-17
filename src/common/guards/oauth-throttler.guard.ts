import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { parseClientCredentials } from '../utils/oauth-credentials';

/**
 * Rate-limit `/oauth/token` по `client_id`, а НЕ по IP.
 *
 * Почему: за обратным прокси/LB все запросы приходят с одного IP — IP-лимит тогда
 * схлопывает всех клиентов в общий бакет (легальных throttлит друг за друга,
 * атакующего не изолирует). `client_id` — стабильная личность запроса: брутфорс
 * секрета конкретного клиента ограничен 10/мин и его НЕЛЬЗЯ обойти ротацией IP.
 * Если `client_id` не извлекается (кривой запрос) — фолбэк на IP.
 *
 * `client_id` берём тем же `parseClientCredentials`, что и аутентификация
 * (`OAuthController`) — бакет лимита и аутентифицируемая личность совпадают, и
 * приоритет Basic-заголовка над телом не даёт обойти лимит мусорным body.client_id.
 */
@Injectable()
export class OAuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const auth = req.headers?.authorization;
    const authHeader = Array.isArray(auth) ? auth[0] : auth;
    const { clientId } = parseClientCredentials(req.body, authHeader);
    return clientId ? `cid:${clientId}` : `ip:${req.ip ?? 'unknown'}`;
  }
}
