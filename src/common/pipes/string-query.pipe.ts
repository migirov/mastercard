import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Валидация ОПЦИОНАЛЬНОГО строкового query-параметра-фильтра (cash-pickup /
 * endpoint-guide) на ГРАНИЦЕ. В отличие от `SafeIdPipe` (для id в ПУТИ) здесь
 * значение идёт в query-строку запроса к MC и URL-кодируется (`qs()`), поэтому
 * спецсимволы/пробелы допустимы (например, город «New York»). Задача пайпа —
 * только отвергнуть НЕ-строку: при `?country[x]=1` / `?country=a&country=b`
 * Express отдаёт объект/массив, и без пайпа фильтр МОЛЧА отбрасывался бы в `qs()`
 * (клиент думал бы, что отфильтровал, а получил бы более широкую выборку).
 * Делаем контракт явным: не-строка → 400. `undefined` (параметр не задан) — ок.
 */
@Injectable()
export class StringQueryPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Query parameter must be a single string value',
      );
    }
    return value;
  }
}
