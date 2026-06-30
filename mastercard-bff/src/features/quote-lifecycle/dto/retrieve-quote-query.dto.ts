import { IsString, MinLength } from 'class-validator';

/**
 * Query for `GET /features/quote-lifecycle/retrieve`. Locates a stored proposal by its
 * original `transactionReference` and `proposalId`. Both required + non-empty (consistent
 * with the other identifier DTOs) — the Strict pipe strips anything not declared here.
 */
export class RetrieveQuoteQueryDto {
  @IsString()
  @MinLength(1)
  transactionReference!: string;

  @IsString()
  @MinLength(1)
  proposalId!: string;
}
