import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/payments`. Структура полиморфна (с котировкой / без /
 * BANKWIRE / carded rate), поэтому валидируем МЯГКО: только формат
 * `transaction_reference` (бэкстоп идемпотентности на стороне MC), остальное
 * пробрасывается в Mastercard как есть.
 */
export class PaymentRequestDto {
  @ApiPropertyOptional({
    description: 'Сквозной reference транзакции (бэкстоп идемпотентности MC).',
  })
  @IsOptional()
  @IsString()
  transaction_reference?: string;
}
