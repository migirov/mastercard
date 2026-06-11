import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CredentialMode } from '../../tenants/tenant.types';

/** Тело POST /admin/tenants — валидируется глобальным ValidationPipe. */
export class CreateTenantDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(CredentialMode)
  credentialMode!: CredentialMode;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  partnerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  secretRef?: string;
}
