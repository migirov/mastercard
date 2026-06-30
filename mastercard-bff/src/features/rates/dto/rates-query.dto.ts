import { IsOptional, IsString } from 'class-validator';

/** Query of `GET /features/rates` — optionally narrow the board to a single pair. */
export class RatesQueryDto {
  /** ISO-4217 base currency to filter by (e.g. `USD`). Paired with `quote`. */
  @IsOptional()
  @IsString()
  base?: string;

  /** ISO-4217 quote currency to filter by (e.g. `ILS`). Paired with `base`. */
  @IsOptional()
  @IsString()
  quote?: string;
}
