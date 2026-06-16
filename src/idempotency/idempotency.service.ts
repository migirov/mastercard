import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
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
    fingerprint?: string,
  ): Promise<T> {
    if (!key) return producer(); // без ключа — без идемпотентности

    const ck = `idem:${scope}:${key}`;
    const cached = await this.kv.get(ck);
    if (cached) return this.resolveExisting<T>(cached, fingerprint);

    // Захватываем «замок» атомарно с КОРОТКИМ TTL: если не вышло — кто-то уже
    // в процессе/готов. Короткий TTL не даёт ключу залипнуть при краше процесса.
    const locked = await this.kv.setIfAbsent(
      ck,
      JSON.stringify({ done: false, fp: fingerprint }),
      LOCK_TTL_SECONDS,
    );
    if (!locked) {
      return this.resolveExisting<T>(await this.kv.get(ck), fingerprint);
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
        JSON.stringify({ done: true, result, fp: fingerprint }),
        RESULT_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(
        `Idempotency: не удалось закэшировать результат для '${ck}': ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * Разбор СУЩЕСТВУЮЩЕЙ записи (кэш-хит ИЛИ проигранная гонка замка): сверяет тело
   * и возвращает готовый результат, иначе бросает 409 «уже в обработке». `raw` может
   * быть null (ключ исчез между проверками) → `p=null`, тело не сверяется, 409.
   */
  private resolveExisting<T>(raw: string | null, fingerprint?: string): T {
    const p = raw ? this.parse(raw) : null;
    this.assertSameBody(p, fingerprint);
    if (p?.done) return p.result as T;
    throw new ConflictException(
      'A request with this Idempotency-Key is already being processed',
    );
  }

  /**
   * Тот же Idempotency-Key с ДРУГИМ телом — это ошибка клиента, а не идемпотентный
   * ретрай: иначе второй (другой) платёж молча вернул бы результат первого. Отдаём
   * 422 (по семантике IETF Idempotency-Key / Stripe).
   */
  private assertSameBody(
    p: { fp?: string } | null,
    fingerprint?: string,
  ): void {
    if (p?.fp && fingerprint && p.fp !== fingerprint) {
      throw new UnprocessableEntityException(
        'Idempotency-Key reused with a different request body',
      );
    }
  }

  /** Безопасный разбор записи замка/результата; битый JSON → null (не 500). */
  private parse(
    raw: string,
  ): { done?: boolean; result?: unknown; fp?: string } | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
