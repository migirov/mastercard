import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /features/iban`. */
export class IbanGenerateDto {
  /** ISO-3166 alpha-3 country (e.g. `FRA`). Optional — the service defaults it to `FRA`. */
  @IsOptional()
  @IsString()
  country?: string;

  /** Domestic account number (BAN) to convert, e.g. `20041010050500013M02606`. */
  @IsOptional()
  @IsString()
  ban?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  accountNo?: string;
}
