import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate-limit `POST /gate/verify` on the source address.
 *
 * The gate password is a 10-digit number. Rate limiting is what bounds automated enumeration of
 * it; it cannot make a short numeric value a good secret, and it is not pretending to.
 *
 * TRACKER CHOICE, and the mistake it avoids: `X-Real-IP` is NOT used, even though this stack's
 * nginx is the thing that sets it. Anyone who can reach the container port directly (a published
 * `127.0.0.1:4010`, a LAN neighbour, another container on the network) can send any `X-Real-IP`
 * they like — so keying on it would let an attacker mint a fresh bucket per request and defeat the
 * limit entirely, while also growing the key space without bound. `X-Forwarded-For`'s first entry
 * is used when present (the standard shape a real proxy chain produces), falling back to `req.ip`,
 * which cannot be forged by the peer.
 *
 * KNOWN LIMITATION, which the limits are sized for: `main.ts` does not set `trust proxy` and this
 * stack's `nginx.conf.template` sets `X-Real-IP` but NOT `X-Forwarded-For`. So in the compose
 * deployment `req.ip` is the nginx container's Docker-network address for EVERY browser, and the
 * bucket is effectively global — 10 attempts per 15 minutes shared by all callers. That is
 * deliberate: making it per-client needs `X-Forwarded-For` plus a correct `trust proxy` hop count,
 * and a wrong hop count behind Cloudflare → host nginx → container nginx keys the limit on the
 * wrong address, which is worse than one honest global bucket.
 */
@Injectable()
export class GateThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const xff = req.headers['x-forwarded-for'];
    const forwarded = (Array.isArray(xff) ? xff[0] : xff)
      ?.split(',')[0]
      ?.trim();
    return `gate:${forwarded || req.ip || 'unknown'}`;
  }
}
