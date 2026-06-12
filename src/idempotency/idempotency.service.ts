import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { KV_STORE, KvStore } from '../store/kv.types';

const RESULT_TTL_SECONDS = 24 * 60 * 60; // сутки — кэш готового результата
const LOCK_TTL_SECONDS = 120; // короткий замок in-progress (> таймаута MC 30с),
// чтобы при краше процесса ключ не залип на сутки

/**
 * Идемпотентность мутаций (платежи): по Idempotency-Key возвращаем тот же
 * результат и не вызываем Mastercard повторно. Защита от двойных списаний при
 * ретраях. Ключ скоупится по тенанту.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject(KV_STORE) private readonly kv: KvStore) {}

  async run<T>(
    scope: string,
    key: string | undefined,
    producer: () => Promise<T>,
  ): Promise<T> {
    if (!key) return producer(); // без ключа — без идемпотентности

    const ck = `idem:${scope}:${key}`;
    const cached = await this.kv.get(ck);
    if (cached) {
      const p = this.parse(cached);
      if (p?.done) return p.result as T;
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed',
      );
    }

    // Захватываем «замок» атомарно с КОРОТКИМ TTL: если не вышло — кто-то уже
    // в процессе/готов. Короткий TTL не даёт ключу залипнуть при краше процесса.
    const locked = await this.kv.setIfAbsent(
      ck,
      JSON.stringify({ done: false }),
      LOCK_TTL_SECONDS,
    );
    if (!locked) {
      const again = await this.kv.get(ck);
      const p = again ? this.parse(again) : null;
      if (p?.done) return p.result as T;
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed',
      );
    }

    let result: T;
    try {
      result = await producer();
    } catch (e) {
      // Освобождаем замок ТОЛЬКО при клиентских 4xx — при них мутация (платёж)
      // точно не прошла, ретрай безопасен. При 5xx/таймауте/сетевой ошибке исход
      // НЕИЗВЕСТЕН (MC мог принять запрос до обрыва) → замок НЕ трогаем (fail-safe
      // против двойного списания): ретрай получит 409, замок истечёт по LOCK_TTL,
      // а MC дедупит по transaction_reference.
      const status = e instanceof HttpException ? e.getStatus() : 500;
      if (status < 500) {
        await this.kv.del(ck);
      }
      throw e;
    }

    // producer (вызов MC) УСПЕШЕН. Кэшируем результат, но сбой кэширования НЕ
    // должен превратить успешный платёж в ошибку клиенту: отдаём результат,
    // замок истечёт по LOCK_TTL.
    try {
      await this.kv.set(
        ck,
        JSON.stringify({ done: true, result }),
        RESULT_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(
        `Idempotency: не удалось закэшировать результат для '${ck}': ${(err as Error).message}`,
      );
    }
    return result;
  }

  /** Безопасный разбор записи замка/результата; битый JSON → null (не 500). */
  private parse(raw: string): { done?: boolean; result?: unknown } | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
