/**
 * Extracts client credentials per RFC 6749 §2.3.1 — from the Basic header or the
 * body (form-urlencoded / JSON). A SINGLE parser: used by both authentication
 * (`OAuthController`) and rate-limiting (`OAuthThrottlerGuard`) so the "request
 * identity" (`client_id`) matches for both. Otherwise the rate-limit bucket and
 * the authenticated identity could diverge — you could throttle one identity while
 * checking the secret of another.
 *
 * Priority: Basic header (the authentic source when present), then the body. This
 * also closes a bucket-bypass: an attacker can't slip a "garbage" `client_id` into
 * the body while keeping real creds in Basic to get a fresh limit every time.
 */
export interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

/** Request body as a form/JSON parser might produce it (values unvalidated). */
interface ClientCredentialsBody {
  client_id?: unknown;
  client_secret?: unknown;
}

export function parseClientCredentials(
  body: ClientCredentialsBody | undefined,
  authHeader: string | undefined,
): ClientCredentials {
  // 1) Basic header takes priority.
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString(
        'utf8',
      );
      const i = decoded.indexOf(':');
      // i > 0 (not >= 0): an empty client_id (":secret") is invalid.
      if (i > 0) {
        return {
          clientId: decoded.slice(0, i),
          clientSecret: decoded.slice(i + 1),
        };
      }
    } catch {
      /* broken base64 — fall through to the body */
    }
  }
  // 2) Body (form-urlencoded / JSON).
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
