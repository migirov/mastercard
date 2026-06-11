import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CredentialMode } from '../../tenants/tenant.types';

/** Тело POST /admin/tenants — валидируется глобальным ValidationPipe. */
export class CreateTenantDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: CredentialMode })
  @IsEnum(CredentialMode)
  credentialMode!: CredentialMode;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  partnerId?: string;

  // Для режима OWN secretRef ОБЯЗАТЕЛЕН (ключи мерчанта из секрет-стора); для
  // PLATFORM — не валидируется (используются платформенные ключи). Раньше эта
  // условная проверка была ручной в AdminService — теперь декларативно в DTO.
  @ApiPropertyOptional({
    maxLength: 256,
    description: 'Обязателен для credentialMode=OWN.',
  })
  @ValidateIf((o) => o.credentialMode === CredentialMode.OWN)
  @IsString()
  @IsNotEmpty({ message: 'secretRef is required for OWN' })
  @MaxLength(256)
  secretRef?: string;
}
