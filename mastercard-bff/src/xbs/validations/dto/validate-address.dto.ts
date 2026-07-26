import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /xbs/validate-address`. */
export class ValidateAddressDto {
  @IsString()
  address!: string;

  /**
   * ISO-3166 alpha-3 country of the address (e.g. ISR, DEU). Mastercard requires it and
   * validates the address against that country's rules, so sending the wrong one produces a
   * confident "invalid" for a correct address. Optional for compatibility: when omitted the
   * service applies `DEFAULT_ADDRESS_COUNTRY` and REPORTS it back in the response, rather
   * than substituting one silently as it used to.
   */
  @IsOptional()
  @IsString()
  country?: string;
}
