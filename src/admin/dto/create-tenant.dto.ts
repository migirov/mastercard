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

/** Тело POST /admin/tenants — валидируется пресетом Strict общей стратегии
 *  валидации (gatewayValidationPipe) на AdminController. */
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

  // partnerId уходит в URL-пути/заголовки запросов к MC. Ограничиваем тем же
  // безопасным charset и длиной, что и SAFE_PARTNER_ID в credential-sanitize
  // (`^[A-Za-z0-9._-]{1,64}$`), иначе плохой partnerId сохранится и упадёт лишь на
  // первой транзакции непрозрачной ошибкой резолва, а не понятным 400 при создании.
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'partnerId: only [A-Za-z0-9._-]' })
  partnerId?: string;

  // Для режима OWN secretRef ОБЯЗАТЕЛЕН (ключи мерчанта из секрет-стора); для
  // PLATFORM — не валидируется (используются платформенные ключи). Раньше эта
  // условная проверка была ручной в AdminService — теперь декларативно в DTO.
  // secretRef интерполируется в ключ-путь секрет-стора (Vault) → ограничиваем
  // charset и запрещаем `..`-сегменты (path-traversal / key-confusion: иначе
  // одного тенанта можно онбордить с ref на чужой/платформенный секрет). Дублируется
  // защитой на границе резолва (safeSecretRef в credential-sanitize).
  @ApiPropertyOptional({
    maxLength: 256,
    description: 'Обязателен для credentialMode=OWN.',
  })
  @ValidateIf((o) => o.credentialMode === CredentialMode.OWN)
  @IsString()
  @IsNotEmpty({ message: 'secretRef is required for OWN' })
  @MaxLength(256)
  @Matches(/^(?!.*\.\.)[A-Za-z0-9._/-]+$/, {
    message: 'secretRef: only [A-Za-z0-9._/-], no ".."',
  })
  secretRef?: string;
}
