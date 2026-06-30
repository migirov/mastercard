import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body of `POST /crossborder/bank-lookups` → MC Bank Information Lookup API.
 * Looks up the recipient bank's details for a payment. `bank` wrapper
 * ({ name?, branchName?, country, bic?, address? }). Uses the Passthrough preset —
 * we only validate the presence/type of the wrapper, MC checks the rest itself.
 */
export class BankLookupRequestDto {
  @ApiProperty({
    description: 'Bank data (bank wrapper).',
    example: {
      country: 'GBR',
      name: 'Bank of ...',
      bic: { type: null, value: null },
    },
  })
  @IsObject()
  bank!: Record<string, unknown>;
}
