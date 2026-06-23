import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Body of `POST /crossborder/address-validations` → MC Address Validation Service.
 * Flat body (no wrapper): `country` + `address` — both mandatory at MC.
 * Uses the Passthrough preset (we only validate the format of critical fields;
 * MC checks everything else itself). The address is validated BEFORE payment so
 * the payment is not rejected due to an invalid recipient address.
 */
export class AddressValidationRequestDto {
  @ApiProperty({ example: 'USA', description: 'ISO recipient country.' })
  @IsString()
  country!: string;

  @ApiProperty({
    example: '4 CLARK STREET, EVERETT, MA, 02149',
    description: 'Single-line address.',
  })
  @IsString()
  address!: string;
}
