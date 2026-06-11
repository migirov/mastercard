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
 * Строгая валидация — только на НАШИХ границах (admin/oauth), не здесь.
 */
export const mcPassthroughPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
    skipMissingProperties: true,
  });
