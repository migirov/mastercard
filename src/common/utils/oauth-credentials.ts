/**
 * Извлечение client credentials по RFC 6749 §2.3.1 — из заголовка Basic или из
 * тела (form-urlencoded / JSON). ЕДИНЫЙ парсер: им пользуются и аутентификация
 * (`OAuthController`), и rate-limit (`OAuthThrottlerGuard`), чтобы «личность
 * запроса» (`client_id`) у обоих совпадала. Иначе бакет лимита и аутентифицируемая
 * личность могли бы разойтись — можно было бы троттлить один identity, проверяя
 * секрет другого.
 *
 * Приоритет — Basic-заголовок (аутентичный источник, когда задан), затем тело. Это
 * также закрывает обход бакета: атакующий не может подсунуть «мусорный» `client_id`
 * в тело, держа реальные креды в Basic, чтобы каждый раз получать свежий лимит.
 */
export interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

/** Тело запроса как мог бы его дать парсер form/JSON (значения непроверенные). */
interface ClientCredentialsBody {
  client_id?: unknown;
  client_secret?: unknown;
}

export function parseClientCredentials(
  body: ClientCredentialsBody | undefined,
  authHeader: string | undefined,
): ClientCredentials {
  // 1) Basic-заголовок приоритетнее.
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString(
        'utf8',
      );
      const i = decoded.indexOf(':');
      // i > 0 (а не >= 0): пустой client_id (":secret") невалиден.
      if (i > 0) {
        return {
          clientId: decoded.slice(0, i),
          clientSecret: decoded.slice(i + 1),
        };
      }
    } catch {
      /* битый base64 — падаем в тело */
    }
  }
  // 2) Тело (form-urlencoded / JSON).
  const id = body?.client_id;
  if (typeof id === 'string' && id) {
    const secret = body?.client_secret;
    return {
      clientId: id,
      clientSecret: typeof secret === 'string' ? secret : undefined,
    };
  }
  return {};
}
