import { Injectable, Logger } from '@nestjs/common';

/**
 * Проверка подлинности входящего вебхука Mastercard ПО СОДЕРЖИМОМУ (подпись), а
 * не по доверию к инфраструктуре. Абстракция — чтобы реализовать схему MC (JWS /
 * HMAC / cert) без изменения вызывающего кода (`WebhookAuthGuard`), как только
 * придёт спецификация подписи от Mastercard (открытый вопрос C1).
 */
export abstract class WebhookSignatureVerifier {
  /**
   * @param headers заголовки запроса (там обычно лежит подпись/таймстамп)
   * @param rawBody сырое тело запроса в байтах (подпись считается по байтам)
   * @returns true, если подпись валидна (или проверка ещё не настроена)
   */
  abstract verify(
    headers: Record<string, unknown>,
    rawBody: Buffer | undefined,
  ): boolean;
}

/**
 * Заглушка до получения спецификации подписи MC (C1): не блокирует приём, но
 * однократно предупреждает в логи, что криптопроверка ещё не включена.
 * НЕ использовать как единственную защиту в проде — заменить реализацией по C1.
 */
@Injectable()
export class NoopSignatureVerifier extends WebhookSignatureVerifier {
  private readonly logger = new Logger(NoopSignatureVerifier.name);
  private warned = false;

  verify(): boolean {
    if (!this.warned) {
      this.logger.warn(
        'Проверка подписи вебхука MC не реализована (ожидается спецификация — вопрос C1). ' +
          'Аутентификация сейчас держится на shared-token (fail-closed). Заменить на JWS/HMAC по C1.',
      );
      this.warned = true;
    }
    return true;
  }
}
