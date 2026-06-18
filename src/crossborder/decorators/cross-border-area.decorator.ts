import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { TenantAuthGuard } from '../../auth/guards/tenant-auth.guard';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { UseGatewayContract } from '../../common/decorators/gateway-contract.decorator';
import { TenantThrottlerGuard } from '../../common/guards/tenant-throttler.guard';

/**
 * Shared cross-cutting decorator for every Cross-Border area controller (issue
 * #16 split). One source of truth for the auth/throttle guards, the Swagger
 * security/headers/error docs and the gateway error+audit contract, so a new
 * area controller cannot forget them or drift.
 *
 * The tenant comes from authentication (OAuth2 Bearer for external merchants or a
 * service token for internal callers), not a header. Guard order matters: auth
 * first (sets the tenant context), then the throttler (limits by tenantId).
 * Each controller still declares its own `@Controller('crossborder')`.
 */
export function CrossBorderArea(): ClassDecorator {
  return applyDecorators(
    ApiTags('cross-border'),
    ApiBearerAuth('merchant'),
    ApiSecurity('internal'), // alt path: X-Internal-Token + X-Tenant-Id
    ApiHeader({
      name: 'X-Tenant-Id',
      required: false,
      description:
        'ID тенанта — ОБЯЗАТЕЛЕН при internal-аутентификации (X-Internal-Token).',
    }),
    ApiErrorResponses(),
    ApiResponse({
      status: 502,
      type: ErrorResponseDto,
      description:
        'Ошибка связи с Mastercard / её ответ (или upstream-статус) скрыт.',
    }),
    UseGuards(TenantAuthGuard, TenantThrottlerGuard),
    UseGatewayContract(),
  );
}
