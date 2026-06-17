import { HttpException } from '@nestjs/common';

/**
 * Ошибка, ПРОБРОШЕННАЯ от Mastercard (или иного upstream). Несёт исходное тело
 * ответа MC, чтобы exception-фильтр вложил его под стабильный ключ `upstream`, а
 * не подменял весь контракт ошибки нативной схемой MC (`{Errors:{Error:...}}`).
 */
export class UpstreamHttpException extends HttpException {
  constructor(
    public readonly upstream: unknown,
    status: number,
  ) {
    super(
      upstream && typeof upstream === 'object'
        ? (upstream as Record<string, unknown>)
        : { message: String(upstream) },
      status,
    );
  }
}
