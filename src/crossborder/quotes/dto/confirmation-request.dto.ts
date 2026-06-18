import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/quotes/confirmations`. По доке MC — ПЛОСКОЕ и в
 * camelCase (в отличие от quote/payment): `{ transactionReference, proposalId }`.
 * Валидируем формат; прочие поля пробрасываются как есть.
 */
export class ConfirmationRequestDto {
  @ApiPropertyOptional({ example: '41C12344311006563' })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({ example: 'pen_4000767745894923464866186' })
  @IsOptional()
  @IsString()
  proposalId?: string;
}
