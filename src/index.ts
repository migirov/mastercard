/**
 * Публичный API встраиваемого модуля — ЕДИНСТВЕННАЯ точка, из которой
 * хост-приложение (`b24club-api`) импортирует символы. Избавляет хост от
 * deep-import'ов по внутренним путям (которые могут меняться). Всё, что НЕ
 * реэкспортировано здесь, — приватная деталь реализации.
 *
 * Контракт встраивания (см. README «Host integration checklist»):
 *   import { MastercardModule, MASTERCARD_ENTITIES } from '<this-package>';
 *   - MastercardModule.forRootAsync({ inject, useFactory }) — единственный импорт-модуль;
 *   - ...MASTERCARD_ENTITIES — включить в TypeOrmModule.forRoot({ entities });
 *   - body-лимит хоста должен пропускать RFI-upload (`POST /crossborder/rfi/documents`,
 *     base64-файл до ~1.37MB) — поднять глобальный json-лимит для этого маршрута.
 */
export { MastercardModule, MASTERCARD_ENTITIES } from './mastercard.module';
export { GatewayConfig } from './config/gateway-config';
export type { MastercardModuleOptions } from './config/gateway-config';
// Host-facing контракты: единый формат ошибок шлюза (хост может на него полагаться
// при обработке наших ответов) и enum'ы для онбординга тенантов через admin-API.
export { ErrorResponseDto } from './common/dto/error-response.dto';
export { CredentialMode, TenantStatus } from './tenants/tenant.types';
