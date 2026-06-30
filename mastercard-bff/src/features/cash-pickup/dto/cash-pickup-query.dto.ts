import { IsOptional, IsString } from 'class-validator';

/**
 * Shared query for the four `GET /features/cash-pickup/*` routes. All fields optional —
 * each route reads the subset it needs (countries → cash_pickup_type; cities →
 * country/currency; providers → +cash_pickup_type; branches → provider_id/city). The
 * Strict pipe strips anything not declared here.
 */
export class CashPickupQueryDto {
  @IsOptional()
  @IsString()
  cash_pickup_type?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  provider_id?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  offset?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
