import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GatewayConfig } from '../../config/gateway-config';
import { safeEqual, sha256hex } from '../../common/crypto.util';

/** Admin-API под отдельным токеном (X-Admin-Token). */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: GatewayConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.headers['x-admin-token'];
    const expected = this.config.adminToken;
    if (
      !expected ||
      !token ||
      !safeEqual(sha256hex(String(token)), sha256hex(expected))
    ) {
      throw new UnauthorizedException('invalid admin token');
    }
    return true;
  }
}
