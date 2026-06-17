import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GatewayConfig } from '../../config/gateway-config';
import { matchSharedToken } from '../../common/utils/crypto.util';

/** Admin-API под отдельным токеном (X-Admin-Token). */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: GatewayConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (
      !matchSharedToken(req.headers['x-admin-token'], this.config.adminToken)
    ) {
      throw new UnauthorizedException('invalid admin token');
    }
    return true;
  }
}
