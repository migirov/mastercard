import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /crossborder/quotes/confirmations`. Per the MC docs it is FLAT
 * and camelCase (unlike quote/payment): `{ transactionReference, proposalId }`.
 * We validate the format; other fields are passed through as-is.
 */
export class ConfirmationRequestDto {
  /**
   * Required: it identifies the quote at Mastercard (which rejects the call without it) AND
   * it is the key the ownership gate checks.
   *
   * Note these validators do NOT reject a MISSING field on this route: MC-bound bodies use
   * the Passthrough pipe (`skipMissingProperties: true`), so an absent property is skipped
   * rather than validated. They constrain the value when one IS sent; enforcement of
   * presence is the ownership gate's job, which fails closed on an absent reference and
   * answers 404. Marking it required here is the contract/Swagger statement, not the check.
   */
  @ApiProperty({ example: '41C12344311006563' })
  @IsString()
  @IsNotEmpty()
  transactionReference!: string;

  @ApiPropertyOptional({ example: 'pen_4000767745894923464866186' })
  @IsOptional()
  @IsString()
  proposalId?: string;
}
