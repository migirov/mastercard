import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { parseClientCredentials } from '../utils/oauth-credentials';

/**
 * Rate-limit `/oauth/token` on a composite of `client_id` AND source IP.
 *
 * Keying on `client_id` alone (the previous design) capped brute-force of a client's secret at
 * 10/min regardless of IP — but it also let anyone who knows a victim's `client_id` (NOT a
 * secret: it rides in the Basic header and is logged at issuance) spend that shared bucket and
 * lock the victim out of minting tokens. Adding the source IP confines each caller to its own
 * slice, so a different-IP attacker cannot exhaust the victim's budget. The vector this reopens
 * — brute-forcing a client's secret at 10/min PER IP — is irrelevant: the secret is 24 random
 * bytes (192 bits), uncrackable at any rate. When `req.ip` is meaningful (direct connections, or
 * TRUST_PROXY set so it reflects the real client via X-Forwarded-For) this isolates attacker from
 * victim; behind an untrusted proxy IP rate-limiting is already degraded system-wide.
 *
 * `client_id` is taken with the same `parseClientCredentials` as authentication
 * (`OAuthController`), so the bucket and the authenticated identity match (Basic-header priority
 * prevents shifting buckets with a garbage `body.client_id`). The larger key space this composite
 * could grow is bounded by `BoundedThrottlerStorage`. Falls back to IP-only when no `client_id`
 * is presented.
 */
@Injectable()
export class OAuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const auth = req.headers?.authorization;
    const authHeader = Array.isArray(auth) ? auth[0] : auth;
    const { clientId } = parseClientCredentials(req.body, authHeader);
    const ip = req.ip ?? 'unknown';
    return clientId ? `cid:${clientId}|ip:${ip}` : `ip:${ip}`;
  }
}
