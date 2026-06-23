import { TenantContext } from '../auth/decorators/current-tenant.decorator';

/**
 * Declaration merging with the standard `express.Request` — adds fields that our
 * guards/infrastructure set at runtime. This is the idiomatic way to type Request
 * extensions (instead of `any`/`Record<string, any>`).
 */
declare global {
  namespace Express {
    interface Request {
      /** Tenant context; set by TenantAuthGuard. */
      tenantContext?: TenantContext;
      /** Request correlation-id; set by nestjs-pino. */
      id?: string;
    }
  }
}

export {};
