import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostgresKvStore } from './postgres-kv.store';

/**
 * Периодическая очистка протухших записей `kv_store` (идемпотентность/дедуп
 * вебхуков, TTL до 24ч). Без неё строки удаляются лениво (при чтении) и таблица
 * растёт мёртвыми записями.
 *
 * Multi-pod: крутится на КАЖДОМ поде, но `DELETE … WHERE expiresAt < now()`
 * идемпотентен и конкурентно-безопасен — лишняя работа, но не ошибка.
 */
@Injectable()
export class KvCleanupService {
  private readonly logger = new Logger(KvCleanupService.name);

  constructor(private readonly kv: PostgresKvStore) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    try {
      const removed = await this.kv.deleteExpired();
      if (removed > 0) {
        this.logger.log(`kv_store: удалено протухших записей — ${removed}`);
      }
    } catch (err) {
      this.logger.error(`kv_store cleanup failed: ${(err as Error).message}`);
    }
  }
}
