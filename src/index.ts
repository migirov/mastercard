/**
 * Публичный API встраиваемого модуля — ЕДИНСТВЕННАЯ точка, из которой
 * хост-приложение (`b24club-api`) импортирует символы. Избавляет хост от
 * deep-import'ов по внутренним путям (которые могут меняться). Всё, что НЕ
 * реэкспортировано здесь, — приватная деталь реализации.
 *
 * Контракт встраивания (см. README «Host integration checklist»):
 *   import { MastercardModule, MASTERCARD_ENTITIES,
 *            RFI_UPLOAD_PATH, rfiUploadBodyParser } from '<this-package>';
 *   - MastercardModule.forRootAsync({ inject, useFactory }) — единственный импорт-модуль;
 *   - ...MASTERCARD_ENTITIES — включить в TypeOrmModule.forRoot({ entities });
 *   - app.use(RFI_UPLOAD_PATH, rfiUploadBodyParser()) — до глобального json-парсера.
 */
export { MastercardModule, MASTERCARD_ENTITIES } from './mastercard.module';
export { GatewayConfig } from './config/gateway-config';
export type { MastercardModuleOptions } from './config/gateway-config';
export {
  RFI_UPLOAD_PATH,
  rfiUploadBodyParser,
} from './common/rfi-upload.bodyparser';
// Host-facing контракты: единый формат ошибок шлюза (хост может на него полагаться
// при обработке наших ответов) и enum'ы для онбординга тенантов через admin-API.
export { ErrorResponseDto } from './common/dto/error-response.dto';
export { CredentialMode, TenantStatus } from './tenants/tenant.types';
