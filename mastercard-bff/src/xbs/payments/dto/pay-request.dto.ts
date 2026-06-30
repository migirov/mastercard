import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

/** Body of `POST /xbs/pay`. We own this contract → strict DTO. */
export class PayRequestDto {
  @IsString()
  transaction_reference!: string;

  @IsString()
  @Length(3, 3)
  payment_currency!: string;

  @IsNumber()
  @IsPositive()
  payment_amount!: number;

  @IsString()
  beneficiary_account!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  source_currency?: string;

  /**
   * Optional invoice references being settled. Arbitrary objects (the frontend's
   * shape), so it is an untyped array — the demo does not act on them, it just
   * accepts them as part of the submission payload.
   */
  @IsOptional()
  @IsArray()
  invoices?: unknown[];
}
