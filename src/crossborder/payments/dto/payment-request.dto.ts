import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { McAmountDto } from '../../common/dto/mc-amount.dto';

/**
 * Inner `paymentrequest` object (Mastercard Payment API). Fields are optional:
 * the structure is polymorphic (with quote / without / BANKWIRE / carded),
 * Mastercard owns the strict schema. We only validate the FORMAT of critical
 * fields (amounts are strings); the rest (`sender`/`recipient`/`bank_code`/…) is
 * passed through as-is.
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

/** Body of `POST /crossborder/payments`. Other MC fields are passed through as-is. */
export class PaymentRequestDto {
  @ApiPropertyOptional({ type: PaymentInnerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentInnerDto)
  paymentrequest?: PaymentInnerDto;
}
