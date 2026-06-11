import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/quotes/confirmations`. Поля MC пробрасываются как есть;
 * валидируем только формат `transaction_reference`, если он передан.
 */
export class ConfirmationRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transaction_reference?: string;
}
