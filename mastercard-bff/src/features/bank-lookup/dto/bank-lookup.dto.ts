import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /features/bank-lookup`. */
export class BankLookupDto {
  /** Bank name to search (MC accepts `*` wildcards, e.g. `*of Africa*`). */
  @IsString()
  name!: string;

  /** ISO-3166 alpha-3 country (e.g. `GBR`). Optional — the service defaults it to `GBR`. */
  @IsOptional()
  @IsString()
  country?: string;

  /** Optional BIC/SWIFT to narrow the search. */
  @IsOptional()
  @IsString()
  bic?: string;
}
