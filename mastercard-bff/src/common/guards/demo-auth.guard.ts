import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { McConfig } from '../../config/mc-config';
import { matchSharedToken } from '../utils/crypto.util';

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
 * Scope, stated honestly: this is ONE trust boundary, not per-user authorization. The SPA
 * carries the same token in its bundle, so anyone who can load the UI can read it. What this
 * stops is unauthenticated direct access to the API (scanners, LAN neighbours, a stray
 * published port), which is what it was open to before.
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

    if (
      !matchSharedToken(
        bearerToken(req.headers.authorization),
        this.config.demoApiToken,
      )
    ) {
      throw new UnauthorizedException('missing or invalid API token');
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
