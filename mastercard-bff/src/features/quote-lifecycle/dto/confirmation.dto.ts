import { IsString, MinLength } from 'class-validator';

/**
 * Body for the state-changing quote-lifecycle routes (`POST confirm` / `POST cancel`).
 * Identifies the proposal to act on: the original `transactionReference` and the
 * `proposalId` returned by the quote. Both required + non-empty (consistent with the
 * other identifier DTOs) — the Strict pipe rejects extras.
 */
export class ConfirmationDto {
  @IsString()
  @MinLength(1)
  transactionReference!: string;

  @IsString()
  @MinLength(1)
  proposalId!: string;
}
