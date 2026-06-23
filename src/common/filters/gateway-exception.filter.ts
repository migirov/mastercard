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
import { UpstreamHttpException } from '../utils/upstream.exception';

/**
 * Unified error contract for OUR controllers. Attached per-controller
 * (`@UseFilters`), NOT globally — an embeddable module must not replace the host
 * application's error handling.
 *
 * Response shapes:
 *   - standard: `{ statusCode, error, message, path, timestamp, requestId }`;
 *   - MC passthrough: the same + `upstream` (the original Mastercard body);
 *   - `/oauth/token`: `{ error }` per RFC 6749 §5.2;
 *   - non-HTTP exception → 500, details only in the log (not leaked outward).
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

    // OAuth2 token endpoint — error format per RFC 6749 §5.2 (`{error}`), with a CODE
    // from a fixed set (don't leak validator messages and don't mask a 5xx as a
    // client-side invalid_request).
    if (req.path?.endsWith('/oauth/token')) {
      res.status(status).json({ error: oauthErrorCode(exception, status) });
      return;
    }

    // requestId — as a string and ONLY when present (ErrorResponseDto contract:
    // optional string, not null/number). path — req.path (without query): don't
    // reflect raw client input (?ref=…) in the error body, and match the DTO example.
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

    // Unknown (non-HTTP) exception: 500, don't return the body outward, details to the log.
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

/** Safe correlation-id format (anti log/echo injection). */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * requestId for the error body. Priority: `req.id` (set by pino's genReqId in the
 * harness, already validated). If it's absent (embedded in a host WITHOUT pino — the
 * module must not rely on the harness's sanitizer), take the incoming `X-Request-Id`,
 * but validate the format OURSELVES: otherwise a raw client header (arbitrary
 * length/charset) would be reflected in the JSON response. If it doesn't fit, omit it.
 */
function resolveRequestId(req: Request): string | undefined {
  if (req.id != null) return String(req.id);
  const raw = req.headers['x-request-id'];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return typeof candidate === 'string' && REQUEST_ID_RE.test(candidate)
    ? candidate
    : undefined;
}

/** Allowed OAuth2 error codes (RFC 6749 §5.2). */
const OAUTH_ERROR_CODES = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
]);

/**
 * Error code for /oauth/token: 5xx → `server_error` (don't mask a failure as a
 * client-side error); 401 → `invalid_client`; otherwise the message if it's a valid
 * RFC code, else `invalid_request` (don't leak validator phrases).
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

/** Extracts the message from an HttpException body (string / Nest object). */
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
