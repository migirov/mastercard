import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { McConfig } from '../../config/mc-config';
import { matchSharedToken } from '../utils/crypto.util';
import { verifyGateProof } from '../utils/gate-proof.util';

/**
 * Paths reachable WITHOUT a token.
 *
 * `/health` is load-bearing: docker-compose's healthcheck curls it, and if this guard ever
 * starts rejecting it the container is marked unhealthy and `depends_on` stalls the stack.
 * Keep this set as small as it is — every entry is a hole punched in the only auth boundary
 * this service has.
 */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/health']);

/**
 * Paths that require the bearer token but NOT a gate proof.
 *
 * EMPTY here, and it must stay empty. This service mints nothing — `POST /gate/verify` lives in
 * app-bff, which is the only reason that route is exempt over there. Every route in this service
 * (`/xbs/*`, `/features/*`) is browser-driven and reaches the real Mastercard sandbox on
 * live-default capabilities, so an exemption copied over from the sibling would be a hole into
 * calls that spend the platform's credentials. The spec asserts the set is empty.
 */
export const GATE_EXEMPT_PATHS: ReadonlySet<string> = new Set<string>();

/** `X-XBS-Gate` header value, normalized — express gives `string | string[] | undefined`. */
function gateProofHeader(
  raw: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * The single authentication boundary for the cross-border BFF: a shared bearer token,
 * registered globally as `APP_GUARD` so routes are deny-by-default.
 *
 * Registered globally on purpose. Per-route decorators would mean remembering a decorator on
 * every one of today's controllers AND every future one, with "unguarded" as the failure mode
 * you get by forgetting — which is precisely how this service shipped with no auth at all.
 * The gateway's "never APP_GUARD" rule does not transfer: that project is an embeddable
 * library a host mounts into its own app, whereas this is a standalone service.
 *
 * This one matters more than its app-bff twin: on live-default capabilities these routes reach
 * the real Mastercard sandbox signed with the platform's OAuth1 key, so an open port here
 * spends the platform's credentials, not just demo rows.
 *
 * TWO factors, both required. The bearer token alone is NOT sufficient: it is served to every
 * anonymous visitor in the frontend's `/config.js`, so on its own it stops scanners and stray
 * published ports, not people. The second factor is the gate proof — HMAC-signed, minted only by
 * app-bff's `POST /gate/verify` against `DEMO_GATE_PASSWORD`, and verified here with the SAME
 * `DEMO_GATE_SECRET`. This service only ever verifies; it never mints.
 *
 * ⚠️ `DEMO_GATE_SECRET` must be byte-identical to app-bff's. If the two drift, the dashboard keeps
 * working while every cross-border page 401s — a confusing partial failure, and the same class of
 * mistake as GATEWAY_INTERNAL_TOKEN drifting from the gateway's MC_INTERNAL_TOKEN.
 *
 * Scope, stated honestly: still not per-user authorization. Everyone who knows the gate password
 * sees everything. What the pair achieves is that passing the gate became a server-side fact.
 */
@Injectable()
export class DemoAuthGuard implements CanActivate {
  constructor(private readonly config: McConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();

    // CORS preflight carries no Authorization header — it is the request ASKING whether that
    // header may be sent. Nest's cors middleware normally answers it before any guard runs;
    // this stays as a guard against a middleware reorder turning every cross-origin call into
    // a confusing 401. OPTIONS exposes no application data.
    if (req.method === 'OPTIONS') return true;

    if (PUBLIC_PATHS.has(normalizePath(req.path))) return true;

    // Bearer first, gate second — deliberately. Both are required, so the order does not change
    // who gets in; checking the cheap shared token first means an unauthenticated caller probing
    // with malformed proofs costs one hash instead of two.
    if (
      !matchSharedToken(
        bearerToken(req.headers.authorization),
        this.config.demoApiToken,
      )
    ) {
      throw new UnauthorizedException('missing or invalid API token');
    }

    if (!GATE_EXEMPT_PATHS.has(normalizePath(req.path))) {
      if (
        !verifyGateProof(
          gateProofHeader(req.headers['x-xbs-gate']),
          this.config.demoGateSecret,
        )
      ) {
        // A machine-readable code, not just a status: the SPA clears its stored proof on seeing
        // this and returns the user to the gate screen, rather than 401ing forever in place.
        throw new UnauthorizedException({
          code: 'gate_required',
          message: 'missing, invalid or expired gate proof',
        });
      }
    }
    return true;
  }
}

/**
 * Trailing slashes only — deliberately NOT a general normalizer. Anything this fails to
 * recognise falls through to the token check (closed), whereas a clever normalizer that
 * over-matches would make a private route public. Errs toward 401, never toward open.
 */
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** `Authorization: Bearer <token>` → the token, or undefined if the header is not that. */
function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer')
    return undefined;
  return parts[1];
}
