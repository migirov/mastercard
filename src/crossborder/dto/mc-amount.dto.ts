import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Денежная сумма Mastercard. ВНИМАНИЕ: `amount` — СТРОКА, не число (поэтому
 * `@IsString`, и pipe для MC-тел идёт без `transform`, чтобы не сконвертировать).
 */
export class McAmountDto {
  @ApiPropertyOptional({
    example: '105.15',
    description: 'Сумма строкой (не число!).',
  })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
