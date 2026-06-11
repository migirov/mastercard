import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit с ключом по tenantId (а не по IP) — лимит на мерчанта.
 *
 * Этот guard ВСЕГДА навешан после TenantAuthGuard (см. CrossBorderController),
 * который кладёт req.tenantContext. Поэтому tenantId обязан присутствовать.
 *
 * Намеренно НЕ деградируем до req.ip/'unknown': за прокси IP не всегда корректен
 * (а 'unknown' — общий бакет, где мерчанты throttлят друг друга). Отсутствие
 * tenantId здесь означает только ошибку конфигурации пайплайна (guard навесили
 * без auth) — падаем явно (fail-closed), а не молча режем чужой трафик.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'TenantThrottlerGuard: missing tenant context (TenantAuthGuard must run before it)',
      );
    }
    return tenantId;
  }
}
