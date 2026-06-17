import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Документирует единый контракт ошибок (`ErrorResponseDto`) для Swagger на типовых
 * статусах. Бандл вместо копипасты `@ApiResponse` на каждом контроллере, чтобы
 * сгенерированный клиент видел предсказуемую форму ошибки везде, а не только там,
 * где её вручную прописали. (Не для `/oauth/token` — там формат RFC 6749 §5.2.)
 */
export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      type: ErrorResponseDto,
      description: 'Невалидный запрос (валидация/формат).',
    }),
    ApiResponse({
      status: 401,
      type: ErrorResponseDto,
      description: 'Не аутентифицирован.',
    }),
    ApiResponse({
      status: 403,
      type: ErrorResponseDto,
      description: 'Доступ запрещён.',
    }),
    ApiResponse({
      status: 500,
      type: ErrorResponseDto,
      description: 'Внутренняя ошибка (детали не раскрываются).',
    }),
  );
}
