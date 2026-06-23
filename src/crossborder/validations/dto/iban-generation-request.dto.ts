import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /crossborder/iban-generations` → MC IBAN Generation API.
 * Generates an IBAN from account details. Fields combine (see the docs): either
 * `accountUri` { type, value }, or `country` + `branchCode` + `accountNo`, or a
 * mix — hence all are optional. Uses the Passthrough preset; MC checks the combination.
 */
export class IbanGenerationRequestDto {
  @ApiPropertyOptional({
    example: { type: 'ban', value: '20041010050500013M02606' },
  })
  @IsOptional()
  @IsObject()
  accountUri?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'FRA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '2004101005' })
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional({ example: '0500013026' })
  @IsOptional()
  @IsString()
  accountNo?: string;
}
