import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CredentialMode, TenantStatus } from '../../tenants/tenant.types';

/**
 * Публичное представление партнёра в ответах admin-API. БЕЗ `secretRef`
 * (секрет наружу не отдаём) + вычисленный `status`. Для типизации и Swagger.
 *
 * `@Expose` на КАЖДОМ поле + `plainToInstance(..., { excludeExtraneousValues:
 * true })` в контроллере = whitelist: наружу попадают ТОЛЬКО перечисленные ниже
 * поля. Любая новая (в т.ч. чувствительная) колонка сущности не «протечёт» по
 * умолчанию — её надо явно добавить сюда, чтобы она появилась в ответе.
 */
export class TenantViewDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty({ enum: CredentialMode })
  credentialMode!: CredentialMode;

  @Expose()
  @ApiPropertyOptional({
    description: 'Только для OWN: собственный partner-id.',
  })
  partnerId?: string;

  @Expose()
  @ApiProperty()
  platformApproved!: boolean;

  @Expose()
  @ApiProperty()
  mcApproved!: boolean;

  @Expose()
  @ApiProperty()
  suspended!: boolean;

  @Expose()
  @ApiProperty({
    enum: TenantStatus,
    description: 'Вычисляемый эффективный статус.',
  })
  status!: TenantStatus;
}
