import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CredentialMode, TenantStatus } from '../../tenants/tenant.types';

/**
 * Public partner representation in admin-API responses. WITHOUT `secretRef`
 * (the secret is never exposed) + a computed `status`. For typing and Swagger.
 *
 * `@Expose` on EVERY field + `plainToInstance(..., { excludeExtraneousValues:
 * true })` in the controller = whitelist: ONLY the fields listed below are
 * exposed. Any new (including sensitive) entity column will not leak by default —
 * it must be explicitly added here to appear in the response.
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
    description: 'OWN only: the partner-supplied partner-id.',
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
    description: 'Computed effective status.',
  })
  status!: TenantStatus;
}
