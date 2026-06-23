import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate-limit keyed by tenantId (not by IP) — a per-merchant limit.
 *
 * This guard is ALWAYS attached after TenantAuthGuard (see CrossBorderController),
 * which sets req.tenantContext. So tenantId is guaranteed to be present.
 *
 * Intentionally NOT degraded to req.ip/'unknown': behind a proxy the IP isn't always
 * correct (and 'unknown' is a shared bucket where merchants throttle each other). A
 * missing tenantId here means only a pipeline misconfiguration (the guard was attached
 * without auth) — fail loudly (fail-closed) rather than silently throttling someone
 * else's traffic.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'TenantThrottlerGuard: missing tenant context (TenantAuthGuard must run before it)',
      );
    }
    return tenantId;
  }
}
