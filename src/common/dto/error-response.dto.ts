import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Единый контракт ошибки для всех наших эндпоинтов (кроме OAuth-токена, который
 * по RFC 6749 §5.2 отдаёт `{error}`). Формируется `GatewayExceptionFilter`.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    description: 'Сообщение или массив сообщений валидации.',
    example: 'Invalid identifier',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: '/crossborder/quotes' })
  path?: string;

  @ApiPropertyOptional({ example: '2026-06-11T14:00:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ description: 'Correlation id (X-Request-Id).' })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Тело ответа Mastercard для проброшенных upstream-ошибок.',
  })
  upstream?: unknown;
}
