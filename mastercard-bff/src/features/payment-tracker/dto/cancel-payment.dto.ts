import { IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /features/payment-tracker/cancel` — cancel a payment by id. The Strict
 * pipe strips anything not declared here; `id` is required.
 */
export class CancelPaymentDto {
  @IsString()
  @MinLength(1)
  id!: string;
}
