import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../services/audit.service';

/**
 * Writes an audit record for every HTTP request of the controller it is attached to.
 * Attached PER-CONTROLLER (`@UseInterceptors(AuditInterceptor)` on our
 * crossborder/admin/oauth/webhooks), NOT globally — so it sees only our routes, not host
 * traffic (health/ready/api-docs and other routes are not audited by construction, with no
 * prefix allowlist).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const res = ctx.switchToHttp().getResponse<Response>();
    const start = Date.now();

    const finish = (status: number) =>
      this.audit.record({
        ts: new Date().toISOString(),
        tenantId: req.tenantContext?.tenantId,
        source: req.tenantContext?.source,
        method: req.method,
        path,
        status,
        ms: Date.now() - start,
      });

    return next.handle().pipe(
      tap({
        next: () => finish(res.statusCode),
        error: (err) => finish(err?.status ?? 500),
      }),
    );
  }
}
