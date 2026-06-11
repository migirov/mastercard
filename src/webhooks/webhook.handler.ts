import { Inject, Injectable, Logger } from '@nestjs/common';
import { KV_STORE, KvStore } from '../store/kv.types';
import { McWebhookEventDto } from './dto/mc-webhook-event.dto';

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // сутки

/**
 * Обработка push-уведомлений Mastercard.
 * - Идемпотентность по eventRef через KV (Postgres, согласован между подами; MC
 *   ретраит до 3 раз → дубли).
 * - Диспетчеризация по eventType.
 */
@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(@Inject(KV_STORE) private readonly kv: KvStore) {}

  async handle(
    event: McWebhookEventDto,
  ): Promise<{ status: 'accepted' | 'duplicate' }> {
    const ref = event?.eventRef ?? event?.notificationId;

    if (ref) {
      const fresh = await this.kv.setIfAbsent(
        `wh:${ref}`,
        '1',
        DEDUP_TTL_SECONDS,
      );
      if (!fresh) {
        this.logger.log(`Дубликат вебхука eventRef=${ref} — игнорируем`);
        return { status: 'duplicate' };
      }
    }

    try {
      switch (event?.eventType) {
        case 'STATUS_CHG':
          this.logger.log(
            `Статус транзакции обновлён: tx=${event?.transactionReference}`,
          );
          // TODO: записать статус в учёт / уведомить мерчанта.
          break;
        default:
          this.logger.log(`Вебхук eventType=${event?.eventType ?? 'unknown'}`);
      }
    } catch (err) {
      // Обработка упала — освобождаем дедуп-ключ, чтобы ретрай MC переобработал
      // (at-least-once), а не потерял событие.
      if (ref) await this.kv.del(`wh:${ref}`).catch(() => undefined);
      throw err;
    }

    return { status: 'accepted' };
  }
}
