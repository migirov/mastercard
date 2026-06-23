import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GatewayConfig } from '../../config/gateway-config';
import { JwtService } from '@nestjs/jwt';
import { matchSharedToken } from '../../common/utils/crypto.util';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { TenantContext } from '../decorators/current-tenant.decorator';

/**
 * Single guard for two entry paths:
 *   - X-Internal-Token present → internal call (we trust X-Tenant-Id);
 *   - otherwise Authorization: Bearer <JWT> → external merchant (tenantId from the token).
 * Sets req.tenantContext.
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly registry: TenantRegistry,
    private readonly config: GatewayConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const internalToken = req.headers['x-internal-token'];
    return internalToken
      ? this.internal(req, String(internalToken))
      : this.external(req);
  }

  private async internal(req: Request, token: string): Promise<boolean> {
    if (!matchSharedToken(token, this.config.internalToken)) {
      throw new UnauthorizedException('invalid internal token');
    }
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      throw new BadRequestException(
        'x-tenant-id is required for internal calls',
      );
    }
    const tenant = await this.registry.get(String(tenantId));
    req.tenantContext = {
      tenantId: tenant.id,
      tenant,
      source: 'internal',
    } satisfies TenantContext;
    return true;
  }

  private async external(req: Request): Promise<boolean> {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    let tid: string;
    try {
      tid = this.jwt.verify<{ tid: string }>(auth.slice(7)).tid;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
    let tenant;
    try {
      tenant = await this.registry.get(tid);
    } catch {
      // valid token, but the partner no longer exists — this is access denied, not a 404
      throw new UnauthorizedException('unknown tenant');
    }
    req.tenantContext = {
      tenantId: tenant.id,
      tenant,
      source: 'external',
    } satisfies TenantContext;
    return true;
  }
}
