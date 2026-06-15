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

    // OAuth2 token endpoint — формат ошибки по RFC 6749 §5.2 (`{error}`), с КОДОМ
    // из фиксированного набора (не утекаем сообщения валидатора и не маскируем
    // 5xx под клиентский invalid_request).
    if (req.path?.endsWith('/oauth/token')) {
      res.status(status).json({ error: oauthErrorCode(exception, status) });
      return;
    }

    // requestId — строкой и ТОЛЬКО при наличии (контракт ErrorResponseDto:
    // optional string, не null/number). path — req.path (без query): не отражаем
    // сырой ввод клиента (?ref=…) в теле ошибки и совпадаем с примером DTO.
    const requestId = resolveRequestId(req);
    const base = {
      statusCode: status,
      path: req.path,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
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

/** Безопасный формат correlation-id (анти log/echo-инъекция). */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * requestId для тела ошибки. Приоритет — `req.id` (его ставит pino genReqId в
 * харнессе, уже валидированный). Если его нет (встраивание в хост БЕЗ pino —
 * модуль не должен полагаться на санитайзер харнесса), берём входящий
 * `X-Request-Id`, но САМИ валидируем формат: иначе сырой клиентский заголовок
 * (произвольная длина/charset) отразился бы в JSON-ответе. Не подошёл — опускаем.
 */
function resolveRequestId(req: Request): string | undefined {
  if (req.id != null) return String(req.id);
  const raw = req.headers['x-request-id'];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return typeof candidate === 'string' && REQUEST_ID_RE.test(candidate)
    ? candidate
    : undefined;
}

/** Допустимые коды ошибок OAuth2 (RFC 6749 §5.2). */
const OAUTH_ERROR_CODES = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
]);

/**
 * Код ошибки для /oauth/token: 5xx → `server_error` (не маскируем сбой под
 * клиентскую ошибку); 401 → `invalid_client`; иначе — сообщение, если это
 * валидный RFC-код, иначе `invalid_request` (не утекаем фразы валидатора).
 */
function oauthErrorCode(exception: unknown, status: number): string {
  if (status >= 500) return 'server_error';
  if (status === 401) return 'invalid_client';
  const m =
    exception instanceof HttpException
      ? messageOf(exception.getResponse())
      : undefined;
  return typeof m === 'string' && OAUTH_ERROR_CODES.has(m)
    ? m
    : 'invalid_request';
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
