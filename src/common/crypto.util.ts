import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Криптостойкий случайный токен (url-safe base64). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 в hex. */
export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Сравнение строк в постоянном времени (защита от timing-атак). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Сравнение предъявленного shared-token с ожидаемым в постоянном времени.
 * Хешируем ОБА входа перед сравнением — это load-bearing: `timingSafeEqual` рано
 * выходит на разной длине (утекая длину секрета), а sha256 выравнивает длину и
 * позволяет безопасно сравнивать входы любой длины. Канонический примитив для
 * гардов: не повторять связку `sha256hex`+`safeEqual` вручную (легко забыть хеш и
 * вернуть length-leak). См. admin/tenant/webhook auth guards.
 */
export function safeTokenEqual(provided: string, expected: string): boolean {
  return safeEqual(sha256hex(provided), sha256hex(expected));
}
