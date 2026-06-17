import { applyDecorators, UseFilters, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor';
import { GatewayExceptionFilter } from '../filters/gateway-exception.filter';

/**
 * Общий cross-cutting контракт контроллеров модуля: единый фильтр ошибок
 * (`GatewayExceptionFilter`) + аудит (`AuditInterceptor`). Бандлим в один
 * декоратор вместо копипасты `@UseFilters`/`@UseInterceptors` на каждом
 * контроллере — чтобы новый контроллер НЕ МОГ случайно остаться без
 * error-контракта/аудита.
 *
 * Намеренно НЕ глобально (`APP_FILTER`/`APP_INTERCEPTOR`): модуль встраиваемый и
 * не должен подменять обработку ошибок/перехват хоста — per-controller связывание
 * сохранено. Гарды специфичны для контроллера и навешиваются отдельно.
 * (AdminController не использует этот декоратор: у него свой набор интерцепторов
 * с `ClassSerializerInterceptor` — оставлен явным.)
 */
export function UseGatewayContract() {
  return applyDecorators(
    UseFilters(GatewayExceptionFilter),
    UseInterceptors(AuditInterceptor),
  );
}
