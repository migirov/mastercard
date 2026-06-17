import { TenantContext } from '../auth/decorators/current-tenant.decorator';

/**
 * Декларативное слияние со стандартным `express.Request` — добавляем поля,
 * которые наши гарды/инфраструктура проставляют в рантайме. Это идиоматичный
 * способ типизировать расширения Request (вместо `any`/`Record<string, any>`).
 */
declare global {
  namespace Express {
    interface Request {
      /** Контекст тенанта; проставляется TenantAuthGuard. */
      tenantContext?: TenantContext;
      /** Correlation-id запроса; проставляется nestjs-pino. */
      id?: string;
    }
  }
}

export {};
