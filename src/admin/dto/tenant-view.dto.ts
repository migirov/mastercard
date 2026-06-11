import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CredentialMode, TenantStatus } from '../../tenants/tenant.types';

/**
 * Публичное представление партнёра в ответах admin-API. БЕЗ `secretRef`
 * (секрет наружу не отдаём) + вычисленный `status`. Для типизации и Swagger.
 */
export class TenantViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: CredentialMode })
  credentialMode!: CredentialMode;

  @ApiPropertyOptional({ description: 'Только для OWN: собственный partner-id.' })
  partnerId?: string;

  @ApiProperty()
  platformApproved!: boolean;

  @ApiProperty()
  mcApproved!: boolean;

  @ApiProperty()
  suspended!: boolean;

  @ApiProperty({ enum: TenantStatus, description: 'Вычисляемый эффективный статус.' })
  status!: TenantStatus;
}
