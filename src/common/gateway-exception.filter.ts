import { STATUS_CODES } from 'http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UpstreamHttpException } from './upstream.exception';

/**
 * Единый контракт ошибок для НАШИХ контроллеров. Навешивается per-controller
 * (`@UseFilters`), а НЕ глобально — встраиваемый модуль не должен подменять
 * обработку ошибок хост-приложения.
 *
 * Формы ответа:
 *   - стандартная: `{ statusCode, error, message, path, timestamp, requestId }`;
 *   - проброс MC: то же + `upstream` (исходное тело Mastercard);
 *   - `/oauth/token`: `{ error }` по RFC 6749 §5.2;
 *   - не-HTTP исключение → 500, детали только в лог (наружу не утекают).
 */
@Catch()
export class GatewayExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GatewayExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // OAuth2 token endpoint — формат ошибки по RFC 6749 §5.2 (`{error}`).
    if (req.path?.endsWith('/oauth/token')) {
      const m =
        exception instanceof HttpException
          ? messageOf(exception.getResponse())
          : undefined;
      res
        .status(status)
        .json({ error: typeof m === 'string' ? m : 'invalid_request' });
      return;
    }

    const base = {
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId: req.id ?? (req.headers['x-request-id'] as string | undefined),
    };

    if (exception instanceof UpstreamHttpException) {
      res.status(status).json({
        ...base,
        error: 'Upstream Error',
        message: 'Mastercard returned an error',
        upstream: exception.upstream,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const r = exception.getResponse();
      const reason = STATUS_CODES[status] ?? 'Error';
      res.status(status).json({
        ...base,
        error:
          (typeof r === 'object' && (r as Record<string, unknown>).error) ||
          reason,
        message: messageOf(r) ?? reason,
      });
      return;
    }

    // Неизвестное (не-HTTP) исключение: 500, тело наружу не отдаём, детали — в лог.
    this.logger.error(
      `Unhandled exception on ${req.method} ${req.url}: ${
        (exception as Error)?.message ?? exception
      }`,
      (exception as Error)?.stack,
    );
    res.status(status).json({
      ...base,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  }
}

/** Достаёт message из тела HttpException (строка / объект Nest). */
function messageOf(response: unknown): string | string[] | undefined {
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    return (response as Record<string, unknown>).message as
      | string
      | string[]
      | undefined;
  }
  return undefined;
}
