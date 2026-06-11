import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /oauth/token` (OAuth2 client_credentials, RFC 6749). Строгая
 * валидация — наша граница. `client_id`/`client_secret` можно передать в теле
 * ИЛИ в заголовке `Authorization: Basic` (§2.3.1), поэтому они опциональны здесь
 * и проверяются на наличие после извлечения в контроллере.
 */
export class TokenRequestDto {
  @ApiProperty({ enum: ['client_credentials'] })
  @IsIn(['client_credentials'])
  grant_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;
}
