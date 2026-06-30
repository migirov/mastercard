import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { parseClientCredentials } from '../utils/oauth-credentials';

/**
 * Rate-limit `/oauth/token` by `client_id`, NOT by IP.
 *
 * Why: behind a reverse proxy/LB all requests arrive from one IP — an IP limit then
 * collapses all clients into a shared bucket (throttling legitimate ones against each
 * other, not isolating the attacker). `client_id` is a stable request identity:
 * brute-forcing a specific client's secret is capped at 10/min and CANNOT be bypassed
 * by IP rotation. If `client_id` can't be extracted (a malformed request), fall back
 * to IP.
 *
 * We take `client_id` with the same `parseClientCredentials` as authentication
 * (`OAuthController`) — the rate-limit bucket and the authenticated identity match, and
 * the Basic header's priority over the body prevents bypassing the limit with a garbage
 * body.client_id.
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
