import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Tenant } from '../tenants/tenant.types';

/** Контекст аутентифицированного запроса, проставляется гардом. */
export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  source: 'external' | 'internal';
}

/** Достаёт TenantContext, который гард положил в request. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.tenantContext as TenantContext;
  },
);
