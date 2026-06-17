import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Валидация идентификатора из пути/квери (`:id`, `:clientId`, `?ref=`) на ГРАНИЦЕ
 * (контроллер), а не вручную в сервисе. Идентификаторы подставляются в путь
 * запроса к Mastercard, поэтому не должны менять структуру URL: запрещены `/`,
 * `\`, пробелы и `..` (path-traversal). Пусто — тоже ошибка (required).
 *
 * Заменяет прежний `assertSafeId`/`if(!ref)` в CrossBorderService.
 */
@Injectable()
export class SafeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    // Сначала type-guard: при `?ref[x]=1` / `?ref=a&ref=b` Express отдаёт объект
    // или массив — `.includes`/regex на не-строке упали бы в 500. Отвергаем как 400.
    if (
      typeof value !== 'string' ||
      !value ||
      /[/\\\s]/.test(value) ||
      value.includes('..')
    ) {
      throw new BadRequestException('Invalid identifier');
    }
    return value;
  }
}
