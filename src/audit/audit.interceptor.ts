import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/** Глобальный интерсептор: пишет audit-запись на каждый HTTP-запрос. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const start = Date.now();

    const finish = (status: number) =>
      this.audit.record({
        ts: new Date().toISOString(),
        tenantId: req.tenantContext?.tenantId,
        source: req.tenantContext?.source,
        method: req.method,
        path: (req.originalUrl ?? req.url ?? '').split('?')[0],
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
