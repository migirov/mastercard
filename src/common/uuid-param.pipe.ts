import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Валидация UUID-идентификатора из пути (RFI `request_id` / `document_id`), который
 * подставляется в URL запроса к Mastercard. MC требует ВАЛИДНЫЙ UUID по RFC-4122 и
 * иначе отвечает `400 062000 INVALID_INPUT_FORMAT "Value contains invalid character"`
 * (Source: `request_id`) — разобрано эмпирически 2026-06-16, см. docs/{ru,en}/api.md (RFI).
 * Проверяем формат на ГРАНИЦЕ (контроллер), чтобы отдать чистый локальный 400 вместо
 * рейс-трипа к MC за невнятной ошибкой и сэкономить исходящий вызов.
 *
 * Принимаем любую версию UUID (1–5) с корректным variant-ниблом (8/9/a/b); отвергаем
 * «нулевые» ниблы версии/варианта (наши прежние демо-id `33000000-…-000…0`,
 * `10000000-…-082000`) и не-hex. Строже, чем `SafeIdPipe` (валидный UUID заведомо не
 * содержит `/`, `\`, пробелов, `..`), поэтому для UUID-параметров заменяет его.
 */
@Injectable()
export class UuidParamPipe implements PipeTransform<unknown, string> {
  // RFC-4122: 8-4-4-4-12 hex; version ∈ 1..5 (3-я группа); variant ∈ {8,9,a,b} (4-я группа).
  private static readonly RFC4122 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  transform(value: unknown): string {
    // type-guard как в SafeIdPipe: при `:id` всегда строка, но дублирующий :param
    // или прокси-кейс не должен ронять pipe в 500 — отвергаем как 400.
    if (typeof value !== 'string' || !UuidParamPipe.RFC4122.test(value)) {
      throw new BadRequestException('Invalid UUID identifier');
    }
    return value;
  }
}
