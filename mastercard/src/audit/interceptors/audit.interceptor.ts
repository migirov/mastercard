import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { clipForLog } from '../../common/utils/sanitize.util';
import { AuditService } from '../services/audit.service';

/** Must match audit_log.path — varchar(512) in the schema. */
const AUDIT_PATH_MAX = 512;

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
    // Truncated to the column width (audit_log.path is varchar(512)) and CRLF-stripped.
    // Without this a single request with an over-length path segment made every subsequent
    // batch INSERT fail with Postgres 22001, and the flush retries the whole batch forever —
    // one caller could stall audit persistence for every tenant. No pipe caps path length
    // (SafeIdPipe has no bound), and this runs BEFORE pipes, so an over-length value reaches
    // the buffer even when the request is ultimately rejected.
    const path = clipForLog(
      (req.originalUrl ?? req.url ?? '').split('?')[0],
      AUDIT_PATH_MAX,
    );
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
