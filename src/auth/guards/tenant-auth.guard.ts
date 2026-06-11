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
import { safeEqual, sha256hex } from '../../common/crypto.util';
import { TenantRegistry } from '../../tenants/tenant.registry';
import { TenantContext } from '../current-tenant.decorator';

/**
 * Единый гард для двух путей входа:
 *   - X-Internal-Token присутствует → внутренний вызов (доверяем X-Tenant-Id);
 *   - иначе Authorization: Bearer <JWT> → внешний мерчант (tenantId из токена).
 * Проставляет req.tenantContext.
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
    const expected = this.config.internalToken;
    if (!expected || !safeEqual(sha256hex(token), sha256hex(expected))) {
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
      tid = this.jwt.verify(auth.slice(7)).tid;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
    let tenant;
    try {
      tenant = await this.registry.get(tid);
    } catch {
      // валидный токен, но партнёра больше нет — это не 404, а отказ доступа
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
