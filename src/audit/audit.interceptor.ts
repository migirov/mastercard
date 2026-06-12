import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/**
 * Пишет audit-запись на каждый HTTP-запрос контроллера, к которому навешан.
 * Навешивается ПЕР-КОНТРОЛЛЕРНО (`@UseInterceptors(AuditInterceptor)` на наших
 * crossborder/admin/oauth/webhooks), а НЕ глобально — поэтому видит только наши
 * роуты, а не трафик хоста (health/ready/api-docs и чужие маршруты не аудируются
 * по построению, без allowlist'а по префиксам).
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
