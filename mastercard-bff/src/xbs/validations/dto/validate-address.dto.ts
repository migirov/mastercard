import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /xbs/validate-address`. */
export class ValidateAddressDto {
  @IsString()
  address!: string;

  /** ISO country (e.g. USA); defaults to USA for the live MC address-validation call. */
  @IsOptional()
  @IsString()
  country?: string;
}
