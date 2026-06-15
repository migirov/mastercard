import { Injectable, Logger } from '@nestjs/common';

/**
 * Каркас для проверки подлинности входящего вебхука Mastercard ПО СОДЕРЖИМОМУ
 * (подпись payload), а не по доверию к инфраструктуре.
 *
 * ВАЖНО (по доке MC, `api-mastercard.md` → FX Rate Push / Status Change Push):
 * авторитетная аутентичность push-уведомлений у Mastercard обеспечивается **mTLS**
 * (публичный mTLS-cert от MC + trust в принимающем приложении + наш серверный
 * cert-chain через KMP-портал), а НЕ подписью тела (JWS/HMAC). То есть подписи
 * payload, которую тут можно было бы проверять, у MC сейчас НЕТ — этот интерфейс
 * остаётся ЗАРЕЗЕРВИРОВАННЫМ на случай, если MC когда-нибудь её добавит (тогда
 * реализация подключится без правок `WebhookAuthGuard`). Активный фактор
 * аутентификации сейчас — fail-closed `X-Webhook-Token`. Детали — docs/{ru,en}/api.md → Webhooks.
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
 * Реализация по умолчанию: подписи payload у вебхука MC нет (аутентичность
 * обеспечивается mTLS на слое TLS-терминации), поэтому проверять в коде нечего —
 * пропускаем, однократно напоминая в лог про требование mTLS. Это НЕ единственная
 * защита: поверх стоит fail-closed `X-Webhook-Token` (`WebhookAuthGuard`).
 */
@Injectable()
export class NoopSignatureVerifier extends WebhookSignatureVerifier {
  private readonly logger = new Logger(NoopSignatureVerifier.name);
  private warned = false;

  verify(): boolean {
    if (!this.warned) {
      this.logger.warn(
        'Подпись payload у вебхука MC в коде не проверяется: по доке MC аутентичность ' +
          'push-уведомлений — это mTLS (публичный cert от MC + trust + cert-chain через KMP-портал), ' +
          'а не подпись тела. Активный фактор — fail-closed X-Webhook-Token. См. api.md → Webhooks.',
      );
      this.warned = true;
    }
    return true;
  }
}
