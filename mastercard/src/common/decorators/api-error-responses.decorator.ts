import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Documents the unified error contract (`ErrorResponseDto`) for Swagger on the common
 * statuses. A bundle instead of copy-pasting `@ApiResponse` on every controller, so the
 * generated client sees a predictable error shape everywhere, not only where it was
 * written out by hand. (Not for `/oauth/token` — that uses the RFC 6749 §5.2 format.)
 */
export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      type: ErrorResponseDto,
      description: 'Invalid request (validation/format).',
    }),
    ApiResponse({
      status: 401,
      type: ErrorResponseDto,
      description: 'Not authenticated.',
    }),
    ApiResponse({
      status: 403,
      type: ErrorResponseDto,
      description: 'Access denied.',
    }),
    ApiResponse({
      status: 500,
      type: ErrorResponseDto,
      description: 'Internal error (details not disclosed).',
    }),
  );
}
