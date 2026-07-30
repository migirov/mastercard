import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AppConfig } from '../../config/app-config';
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
 * Exactly one entry, and it cannot be otherwise: `/gate/verify` is what MINTS a proof, so
 * requiring one to reach it would make the gate unopenable. It is still behind the token check,
 * so this is not a public route.
 *
 * The sibling mastercard-bff has this set EMPTY — it never mints anything. Copying this set over
 * there would silently exempt a cross-border route; its spec asserts the set stays empty.
 */
export const GATE_EXEMPT_PATHS: ReadonlySet<string> = new Set(['/gate/verify']);

/** `X-XBS-Gate` header value, normalized — express gives `string | string[] | undefined`. */
function gateProofHeader(
  raw: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * The single authentication boundary for the demo BFF: a shared bearer token, registered
 * globally as `APP_GUARD` so routes are deny-by-default.
 *
 * Registered globally on purpose. Per-route decorators would mean remembering a decorator on
 * every one of today's controllers AND every future one, with "unguarded" as the failure mode
 * you get by forgetting — which is precisely how this service shipped with no auth at all.
 * The gateway's "never APP_GUARD" rule does not transfer: that project is an embeddable
 * library a host mounts into its own app, whereas this is a standalone service.
 *
 * TWO factors, both required. The bearer token alone is NOT sufficient: it is served to every
 * anonymous visitor in `/config.js`, so on its own it is a barrier against scanners and stray
 * published ports, not a boundary against people. The second factor is the gate proof — an
 * HMAC-signed value that `POST /gate/verify` mints only against `DEMO_GATE_PASSWORD`, and which
 * therefore cannot be forged from anything the browser is given.
 *
 * Scope, stated honestly: this is still not per-user authorization. Everyone who knows the gate
 * password sees every record. What the pair achieves is that passing the gate is now a server-side
 * fact rather than a client-side decision — flipping `sessionStorage.xbs_access_granted` in
 * devtools no longer buys access to any data.
 */
@Injectable()
export class DemoAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

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
