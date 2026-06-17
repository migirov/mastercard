import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentIdempotencyEntity } from './payment-idempotency.entity';

/**
 * Короткий замок in-progress (> таймаута MC 30с): если процесс упадёт между
 * захватом слота и записью результата, запись считается протухшей через LOCK_TTL
 * и перезахватывается следующим retry (ключ не залипает навсегда). Готовые
 * (`done=true`) записи живут постоянно — это и есть идемпотентность платежа.
 */
const LOCK_TTL_SECONDS = 120;

/**
 * Идемпотентность платежей на PostgreSQL — источник истины по
 * `transaction_reference` (через `payment_idempotency`). Заменяет KV-слой
 * (`IdempotencyService` поверх `kv_store`): тот же ключ → тот же результат без
 * повторного вызова MC. Поведение сохранено 1:1 (кэш результата, 409 in-progress,
 * 422 «тот же ключ, другое тело», fail-safe при 5xx) — поменялся только бэкенд.
 */
@Injectable()
export class PaymentIdempotencyStore {
  private readonly logger = new Logger(PaymentIdempotencyStore.name);

  constructor(
    @InjectRepository(PaymentIdempotencyEntity)
    private readonly repo: Repository<PaymentIdempotencyEntity>,
  ) {}

  async run<T>(
    tenantId: string,
    key: string | undefined,
    producer: () => Promise<T>,
    fingerprint: string,
  ): Promise<T> {
    if (!key) return producer(); // без ключа (нет transaction_reference) — без идемпотентности

    // Захват слота атомарно: вставить НОВЫЙ, ЛИБО перезахватить ПРОТУХШИЙ in-progress
    // замок (краш процесса). Если слот занят свежим in-progress или уже готов —
    // вернётся false, и существующую запись разбираем ниже.
    const owned = await this.acquire(tenantId, key, fingerprint);
    if (!owned) return this.resolveExisting<T>(tenantId, key, fingerprint);

    let result: T;
    try {
      result = await producer();
    } catch (e) {
      // Освобождаем слот ТОЛЬКО при клиентских 4xx — при них мутация (платёж) точно
      // не прошла, ретрай безопасен. При 5xx/таймауте/сетевой ошибке исход НЕИЗВЕСТЕН
      // (MC мог принять до обрыва) → слот НЕ трогаем (fail-safe против двойного
      // списания): ретрай в окне LOCK_TTL получит 409, после — перезахватит замок,
      // а MC дедупит по transaction_reference.
      const status = e instanceof HttpException ? e.getStatus() : 500;
      if (status < 500) await this.release(tenantId, key);
      throw e;
    }

    // Вызов MC УСПЕШЕН — фиксируем результат. Сбой записи НЕ должен превратить
    // успешный платёж в ошибку клиенту: отдаём результат, замок протухнет по LOCK_TTL.
    try {
      await this.repo.update(
        { tenantId, idemKey: key },
        { result: result as never, done: true },
      );
    } catch (err) {
      this.logger.error(
        `payment_idempotency: не удалось зафиксировать результат для '${key}': ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * Атомарный захват слота одним стейтментом: `INSERT ... ON CONFLICT DO UPDATE`,
   * где UPDATE срабатывает ТОЛЬКО для протухшего in-progress замка (краш процесса).
   * `RETURNING id` непуст ⇔ мы вставили новую запись ИЛИ перезахватили протухшую →
   * владеем слотом. Свежий in-progress / готовая запись → `WHERE` ложно → 0 строк.
   */
  private async acquire(
    tenantId: string,
    key: string,
    fingerprint: string,
  ): Promise<boolean> {
    const rows = await this.repo.query(
      `INSERT INTO payment_idempotency ("tenantId", "idemKey", fingerprint, done, "lockedAt")
       VALUES ($1, $2, $3, false, now())
       ON CONFLICT ("tenantId", "idemKey") DO UPDATE
         SET "lockedAt" = now(), fingerprint = EXCLUDED.fingerprint
         WHERE payment_idempotency.done = false
           AND payment_idempotency."lockedAt" < now() - make_interval(secs => $4)
       RETURNING id`,
      [tenantId, key, fingerprint, LOCK_TTL_SECONDS],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  /**
   * Разбор СУЩЕСТВУЮЩЕЙ записи (захват не удался — слот занят): сверяет тело и
   * отдаёт готовый результат, иначе 409 «уже в обработке». Запись могла исчезнуть
   * между захватом и чтением (конкурентный 4xx-release) → 409, клиент повторит.
   */
  private async resolveExisting<T>(
    tenantId: string,
    key: string,
    fingerprint: string,
  ): Promise<T> {
    const row = await this.repo.findOne({ where: { tenantId, idemKey: key } });
    this.assertSameBody(row?.fingerprint, fingerprint);
    if (row?.done) return row.result as T;
    throw new ConflictException(
      'A payment with this transaction_reference is already being processed',
    );
  }

  /**
   * Тот же `transaction_reference` с ДРУГИМ телом — ошибка клиента, не идемпотентный
   * ретрай: иначе второй (другой) платёж молча вернул бы результат первого. 422 (по
   * семантике IETF Idempotency-Key / Stripe).
   */
  private assertSameBody(stored: string | undefined, fingerprint: string): void {
    if (stored && stored !== fingerprint) {
      throw new UnprocessableEntityException(
        'transaction_reference reused with a different request body',
      );
    }
  }

  /** Освободить in-progress слот (только при клиентском 4xx — платёж не прошёл). */
  private async release(tenantId: string, key: string): Promise<void> {
    await this.repo.delete({ tenantId, idemKey: key, done: false });
  }
}
