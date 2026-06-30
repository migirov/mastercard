import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /crossborder/account-validations` → MC Account Validation API.
 * Validates the recipient account BEFORE payment. Uses the Passthrough preset —
 * we only validate critical top-level fields, MC checks the rest (accountDetails
 * etc.) itself. `accountUri` is mandatory at MC (object { type, value }).
 */
export class AccountValidationRequestDto {
  @ApiProperty({
    description: 'Recipient account.',
    example: { type: 'IBAN', value: 'FR070331234567890123456' },
  })
  @IsObject()
  accountUri!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Service type: CES (Card Eligibility) | ASV (Account Status).',
  })
  @IsOptional()
  @IsString()
  requestType?: string;
}
