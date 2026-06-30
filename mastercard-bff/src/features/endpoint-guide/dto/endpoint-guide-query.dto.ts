import { IsOptional, IsString } from 'class-validator';

/**
 * Query for `GET /features/endpoint-guide` — the corridor selector. All fields optional:
 * each narrows the corridor whose field requirements are returned. Defaults
 * (B2B / PHL / PHP / BANK) are applied in the service when omitted. The Strict pipe
 * strips anything not declared here.
 */
export class EndpointGuideQueryDto {
  @IsOptional()
  @IsString()
  payment_type?: string;

  @IsOptional()
  @IsString()
  destination_country?: string;

  @IsOptional()
  @IsString()
  destination_currency?: string;

  @IsOptional()
  @IsString()
  destination_payment_instrument?: string;
}
