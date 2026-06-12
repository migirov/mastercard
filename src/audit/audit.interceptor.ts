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
 * Префиксы маршрутов ЭТОГО модуля. Аудируем только их (allowlist), а не всё
 * подряд: интерцептор зарегистрирован как APP_INTERCEPTOR (глобальный), и при
 * встраивании в монолит он иначе писал бы в audit_log трафик всего хоста (чужие
 * роуты с tenantId=undefined). Заодно отсекает health/ready/api-docs.
 */
const AUDIT_PREFIXES = ['/crossborder', '/admin', '/oauth', '/webhooks'];

/** Глобальный интерсептор: пишет audit-запись на каждый HTTP-запрос. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (!AUDIT_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle(); // не маршрут модуля (или health/ready/api-docs) — не аудируем
    }
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
