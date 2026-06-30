import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

/**
 * Body of `POST /xbs/quote`. We OWN this contract (unlike the gateway's passthrough
 * MC bodies), so it is a strict class-validator DTO. Currencies are 3-letter ISO
 * codes; the amount is a positive number (the demo's own simplified shape, not MC's
 * string-amount envelope).
 */
export class QuoteRequestDto {
  @IsString()
  @Length(3, 3)
  source_currency!: string;

  @IsString()
  @Length(3, 3)
  target_currency!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
