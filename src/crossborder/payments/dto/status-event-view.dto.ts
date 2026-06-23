import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public representation of a stored push status in the
 * `GET /crossborder/status-events` response. The mapping from
 * `TransactionStatusEntity` is EXPLICIT (field-by-field), not a return of the
 * entity: internal `id` (a serial PK — otherwise cross-tenant info about
 * volume/order) and `tenantId` (internal attribution, meaningless to the
 * merchant) do NOT leak out. Any new entity column will not "leak" by default —
 * it must be added explicitly here and in the mapper.
 */
export class StatusEventViewDto {
  @ApiPropertyOptional({
    description: 'transaction_reference of the transaction/quote.',
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
    description: 'pendingStage, if present.',
  })
  stage!: string | null;

  @ApiProperty({ description: 'Time the notification was received (ISO).' })
  receivedAt!: Date;

  @ApiProperty({
    description: 'Raw (normalized) MC notification body in full.',
    type: 'object',
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}
