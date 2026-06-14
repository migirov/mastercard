import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Валидация заголовка `Idempotency-Key` на ГРАНИЦЕ (контроллер), а не вручную в
 * сервисе. Ключ уходит в `kv_store.key` (varchar 256), поэтому ограничиваем
 * длину (≤128) и безопасный charset `[A-Za-z0-9._:-]` — иначе длинный/кривой
 * ключ → ошибка БД → 500. UUID и обычные токены укладываются. (Тире в тексте
 * намеренно последнее — чтобы строку нельзя было ошибочно скопировать как
 * regex-диапазон `-:`.)
 *
 * Заголовок ОПЦИОНАЛЕН: если не передан (`undefined`), пропускаем дальше как
 * `undefined` — идемпотентность тогда просто не применяется. Пустую строку
 * (заголовок прислан, но пустой) считаем ошибкой. Заменяет прежний ручной
 * `if (key.length > 128 || !regex)` в CrossBorderService.createPayment.
 */
@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (
      typeof value !== 'string' ||
      value.length > 128 ||
      !/^[\w.\-:]+$/.test(value)
    ) {
      throw new BadRequestException(
        'Idempotency-Key: up to 128 chars from [A-Za-z0-9._:-]',
      );
    }
    return value;
  }
}
