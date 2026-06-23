import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /oauth/token` (OAuth2 client_credentials, RFC 6749). Strict
 * validation is our boundary. `client_id`/`client_secret` may be passed in the
 * body OR in the `Authorization: Basic` header (§2.3.1), so they are optional
 * here and their presence is checked after extraction in the controller.
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
