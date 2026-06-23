import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Tenant } from '../../tenants/tenant.types';

/** Authenticated request context, set by the guard. */
export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  source: 'external' | 'internal';
}

/** Extracts the TenantContext that the guard placed on the request. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.tenantContext as TenantContext;
  },
);
