import { ValidationPipe } from '@nestjs/common';

/**
 * Pipe для тел, которые ПРОБРАСЫВАЮТСЯ в Mastercard как есть. Валидируем только
 * формат объявленных критичных полей, но:
 *   - `whitelist: false` — НЕ вырезаем неизвестные поля MC (схема большая и
 *     меняется; вырезание потеряло бы данные мерчанта);
 *   - `forbidNonWhitelisted: false` — не отвергаем запрос из-за «лишних» полей;
 *   - `transform: false` — НЕ конвертируем типы (суммы MC — СТРОКИ, превращение
 *     в number сломало бы payload и подпись). Хендлер получает исходный объект.
 *
 * Парный к `strictDtoPipe` (строгая валидация на НАШИХ границах — admin/oauth).
 * Лежит в `common/`, т.к. используется и crossborder, и webhooks (а не только
 * crossborder) — общий cross-cutting, не приватная деталь одного модуля.
 */
export const mcPassthroughPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
    skipMissingProperties: true,
  });
