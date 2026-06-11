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
export class SafeIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || /[/\\\s]/.test(value) || value.includes('..')) {
      throw new BadRequestException('Invalid identifier');
    }
    return value;
  }
}
