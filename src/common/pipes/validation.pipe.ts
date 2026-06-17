import { ValidationPipe } from '@nestjs/common';

/**
 * Строгий pipe для НАШИХ границ (admin, oauth): вырезаем неизвестные поля,
 * отвергаем лишние, приводим типы. Навешивается на контроллер/маршрут явно —
 * модуль НЕ полагается на глобальный pipe (его в хост-монолите может не быть или
 * он может быть другим). MC-passthrough маршруты используют свой мягкий pipe
 * (см. common/pipes/mc-passthrough.pipe).
 */
export const strictDtoPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
