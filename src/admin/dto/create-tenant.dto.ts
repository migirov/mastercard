import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CredentialMode } from '../../tenants/tenant.types';

/** Тело POST /admin/tenants — валидируется strictDtoPipe на AdminController. */
export class CreateTenantDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: CredentialMode })
  @IsEnum(CredentialMode)
  credentialMode!: CredentialMode;

  // id становится первичным ключом тенанта и потом фигурирует в путях admin
  // `:id` (через SafeIdPipe). Ограничиваем тем же безопасным charset, иначе можно
  // создать тенанта с id, который SafeIdPipe затем отвергнет (станет неадресуемым).
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'id: only [A-Za-z0-9._-]' })
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
