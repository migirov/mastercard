import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Unified error contract for all our endpoints (except the OAuth token, which per
 * RFC 6749 §5.2 returns `{error}`). Produced by `GatewayExceptionFilter`.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    description: 'A message or an array of validation messages.',
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
    description: 'Mastercard response body for propagated upstream errors.',
  })
  upstream?: unknown;
}
