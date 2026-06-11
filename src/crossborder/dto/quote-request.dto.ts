import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { McAmountDto } from './mc-amount.dto';

/**
 * Внутренний объект `quoterequest` (Mastercard Quotes API). Поля опциональны:
 * жёсткую схему держит Mastercard, мы валидируем только ФОРМАТ критичных полей
 * (например, что сумма — строка). Неизвестные поля (`quote_type`,
 * `payment_origination_country`, …) пробрасываются как есть.
 */
export class QuoteInnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transaction_reference?: string;

  @ApiPropertyOptional({ example: 'tel:+25406005' })
  @IsOptional()
  @IsString()
  sender_account_uri?: string;

  @ApiPropertyOptional({ example: 'tel:+254069832' })
  @IsOptional()
  @IsString()
  recipient_account_uri?: string;

  @ApiPropertyOptional({ type: McAmountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => McAmountDto)
  payment_amount?: McAmountDto;

  @ApiPropertyOptional({ example: 'P2P' })
  @IsOptional()
  @IsString()
  payment_type?: string;
}

/** Тело `POST /crossborder/quotes`. Прочие поля MC пробрасываются как есть. */
export class QuoteRequestDto {
  @ApiPropertyOptional({ type: QuoteInnerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteInnerDto)
  quoterequest?: QuoteInnerDto;
}
