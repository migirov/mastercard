import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Публичное представление сохранённого push-статуса в ответе
 * `GET /crossborder/status-events`. Маппинг из `TransactionStatusEntity` —
 * ЯВНЫЙ (поле-в-поле), а не возврат сущности: наружу НЕ утекают внутренние
 * `id` (серийный PK — иначе кросс-тенантная инфа об объёме/порядке) и `tenantId`
 * (внутренняя атрибуция, мерчанту бессмысленна). Любая новая колонка сущности не
 * «протечёт» по умолчанию — её надо явно добавить и сюда, и в маппер.
 */
export class StatusEventViewDto {
  @ApiPropertyOptional({
    description: 'transaction_reference транзакции/котировки.',
  })
  transactionReference!: string | null;

  @ApiPropertyOptional({ example: 'STATUS_CHG' })
  eventType!: string | null;

  @ApiPropertyOptional({ example: 'PAYMENT', description: 'QUOTE | PAYMENT.' })
  transactionType!: string | null;

  @ApiPropertyOptional({ example: 'CONFIRMED' })
  status!: string | null;

  @ApiPropertyOptional({
    example: 'Expired',
    description: 'pendingStage, если есть.',
  })
  stage!: string | null;

  @ApiProperty({ description: 'Момент приёма уведомления (ISO).' })
  receivedAt!: Date;

  @ApiProperty({
    description: 'Сырое (нормализованное) тело уведомления MC целиком.',
    type: 'object',
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}
