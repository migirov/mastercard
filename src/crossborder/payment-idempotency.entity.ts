import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Идемпотентность платежей поверх PostgreSQL — источник истины по
 * `transaction_reference` (бизнес-ключ платежа у MC). Заменяет прежний слой KV
 * (`kv_store` + IdempotencyService): retry с тем же `transaction_reference` →
 * тот же результат БЕЗ повторного вызова MC (защита от двойного списания).
 *
 * `(tenantId, idemKey)` UNIQUE → захват слота И защита от гонок атомарны (один
 * `INSERT ... ON CONFLICT`). `idemKey` = `txref:sha256(transaction_reference)`
 * (хеш — ref произвольной длины/charset у клиента; tenant скоупит ключ).
 *
 * Семантика записи:
 *   - `done=false`            — слот захвачен, вызов MC in-progress (короткий
 *                               замок: `lockedAt`; протух → следующий retry
 *                               перезахватывает, чтобы краш процесса не залипил
 *                               ключ навсегда);
 *   - `done=true` + `result`  — вызов MC завершён, кэш ответа (ретраи отдаём из
 *                               БД, MC не дёргаем). Готовые записи НЕ удаляются
 *                               (постоянная идемпотентность — безопаснее старого
 *                               TTL 24ч: один `transaction_reference` = один
 *                               платёж навсегда).
 *   - `fingerprint`           — sha256 тела: тот же ref с ДРУГИМ телом → 422.
 */
@Entity('payment_idempotency')
@Unique('UQ_payment_idem_tenant_key', ['tenantId', 'idemKey'])
export class PaymentIdempotencyEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  /** `txref:sha256(transaction_reference)` — 6 + 64 hex. */
  @Column({ type: 'varchar', length: 80 })
  idemKey!: string;

  /** sha256(JSON тела платежа) — детектор «тот же ключ, другое тело» (→ 422). */
  @Column({ type: 'varchar', length: 64 })
  fingerprint!: string;

  /** Кэш ответа MC; NULL пока вызов in-progress (`done=false`). */
  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  done!: boolean;

  /**
   * Момент захвата/перезахвата слота. Для in-progress (`done=false`) играет роль
   * короткого замка: запись старше LOCK_TTL считается «протухшей» (процесс упал
   * между захватом и записью результата) и перезахватывается следующим retry.
   * Индекса НЕТ намеренно: `lockedAt` проверяется только в `acquire` как фильтр уже
   * найденной по UNIQUE(tenantId, idemKey) строки (не индекс-скан), а фоновой
   * очистки по `lockedAt` нет — индекс был бы мёртвым оверхедом на запись.
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  lockedAt!: Date;
}
