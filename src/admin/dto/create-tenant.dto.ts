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

/** Body of POST /admin/tenants — validated by the Strict preset of the shared
 *  validation strategy (gatewayValidationPipe) on AdminController. */
export class CreateTenantDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: CredentialMode })
  @IsEnum(CredentialMode)
  credentialMode!: CredentialMode;

  // id becomes the tenant primary key and later appears in admin `:id` paths
  // (via SafeIdPipe). We restrict it to the same safe charset, otherwise a tenant
  // could be created with an id that SafeIdPipe then rejects (becoming unaddressable).
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'id: only [A-Za-z0-9._-]' })
  id?: string;

  // partnerId goes into URL paths/headers of requests to MC. We restrict it to the
  // same safe charset and length as SAFE_PARTNER_ID in credential-sanitize
  // (`^[A-Za-z0-9._-]{1,64}$`), otherwise a bad partnerId would be persisted and fail
  // only on the first transaction with an opaque resolve error, not a clear 400 at creation.
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'partnerId: only [A-Za-z0-9._-]' })
  partnerId?: string;

  // For OWN mode secretRef is REQUIRED (merchant keys from the secret store); for
  // PLATFORM it is not validated (platform keys are used). This conditional check used
  // to be manual in AdminService — now it is declarative in the DTO.
  // secretRef is an AWS Secrets Manager secret name or ARN → we restrict the charset
  // to the AWS-allowed set (name: [A-Za-z0-9/_+=.@-]; ARN adds `:`) and forbid `..`
  // segments (key-confusion: otherwise a tenant could be onboarded with a ref to
  // another/platform secret). Duplicated by the guard at the resolve boundary
  // (safeSecretRef in credential-sanitize).
  @ApiPropertyOptional({
    maxLength: 256,
    description: 'Required for credentialMode=OWN. AWS Secrets Manager name or ARN.',
  })
  @ValidateIf((o) => o.credentialMode === CredentialMode.OWN)
  @IsString()
  @IsNotEmpty({ message: 'secretRef is required for OWN' })
  @MaxLength(256)
  @Matches(/^(?!.*\.\.)[A-Za-z0-9._/+=@:-]+$/, {
    message: 'secretRef: only [A-Za-z0-9._/+=@:-], no ".."',
  })
  secretRef?: string;
}
