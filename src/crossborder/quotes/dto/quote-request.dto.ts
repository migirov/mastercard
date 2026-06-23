import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { McAmountDto } from '../../common/dto/mc-amount.dto';

/**
 * Inner `quoterequest` object (Mastercard Quotes API). Fields are optional:
 * Mastercard owns the strict schema, we only validate the FORMAT of critical
 * fields (e.g. that the amount is a string). Unknown fields (`quote_type`,
 * `payment_origination_country`, …) are passed through as-is.
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

/** Body of `POST /crossborder/quotes`. Other MC fields are passed through as-is. */
export class QuoteRequestDto {
  @ApiPropertyOptional({ type: QuoteInnerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteInnerDto)
  quoterequest?: QuoteInnerDto;
}
