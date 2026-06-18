import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/iban-generations` → MC IBAN Generation API.
 * Генерирует IBAN из реквизитов. Поля комбинируются (см. доку): либо `accountUri`
 * { type, value }, либо `country` + `branchCode` + `accountNo`, либо их сочетание —
 * поэтому все опциональны. Идёт через пресет Passthrough; MC проверяет комбинацию.
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
