import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /crossborder/quotes/confirmations`. Per the MC docs it is FLAT
 * and camelCase (unlike quote/payment): `{ transactionReference, proposalId }`.
 * We validate the format; other fields are passed through as-is.
 */
export class ConfirmationRequestDto {
  @ApiPropertyOptional({ example: '41C12344311006563' })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({ example: 'pen_4000767745894923464866186' })
  @IsOptional()
  @IsString()
  proposalId?: string;
}
