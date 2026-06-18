import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { McAmountDto } from '../../common/dto/mc-amount.dto';

/**
 * Внутренний объект `paymentrequest` (Mastercard Payment API). Поля опциональны:
 * структура полиморфна (с котировкой / без / BANKWIRE / carded), жёсткую схему
 * держит Mastercard. Валидируем только ФОРМАТ критичных полей (суммы — строки),
 * остальное (`sender`/`recipient`/`bank_code`/…) пробрасывается как есть.
 */
export class PaymentInnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transaction_reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sender_account_uri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipient_account_uri?: string;

  @ApiPropertyOptional({ type: McAmountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => McAmountDto)
  payment_amount?: McAmountDto;

  @ApiPropertyOptional({ example: 'P2B' })
  @IsOptional()
  @IsString()
  payment_type?: string;
}

/** Тело `POST /crossborder/payments`. Прочие поля MC пробрасываются как есть. */
export class PaymentRequestDto {
  @ApiPropertyOptional({ type: PaymentInnerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentInnerDto)
  paymentrequest?: PaymentInnerDto;
}
