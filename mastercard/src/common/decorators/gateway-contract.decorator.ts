import { applyDecorators, UseFilters, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor';
import { GatewayExceptionFilter } from '../filters/gateway-exception.filter';

/**
 * Shared cross-cutting contract for the module's controllers: a single error filter
 * (`GatewayExceptionFilter`) + audit (`AuditInterceptor`). Bundled into one decorator
 * instead of copy-pasting `@UseFilters`/`@UseInterceptors` on every controller — so a
 * new controller CAN'T accidentally end up without the error contract / audit.
 *
 * Intentionally NOT global (`APP_FILTER`/`APP_INTERCEPTOR`): the module is embeddable
 * and must not replace the host's error handling / interception — per-controller
 * binding is preserved. Guards are controller-specific and attached separately.
 * (AdminController doesn't use this decorator: it has its own interceptor set with
 * `ClassSerializerInterceptor` — left explicit.)
 */
export function UseGatewayContract() {
  return applyDecorators(
    UseFilters(GatewayExceptionFilter),
    UseInterceptors(AuditInterceptor),
  );
}
