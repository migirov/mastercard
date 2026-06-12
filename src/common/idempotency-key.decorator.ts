import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Достаёт заголовок `Idempotency-Key` из запроса. Отдельный декоратор нужен
 * потому, что встроенный `@Headers('name', Pipe)` НЕ принимает pipe в типах —
 * а `createParamDecorator` поддерживает pipe-аргументы. Применять вместе с
 * валидатором: `@IdempotencyKey(IdempotencyKeyPipe) key?: string`.
 *
 * Возвращает сырое значение (string | string[] | undefined); проверку формата
 * делает IdempotencyKeyPipe на границе.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | string[] | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.headers['idempotency-key'];
  },
);
