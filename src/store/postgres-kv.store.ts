import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KvEntity } from './kv.entity';
import { KvStore } from './kv.types';

/** KV поверх PostgreSQL с TTL. Согласован между подами. */
@Injectable()
export class PostgresKvStore implements KvStore {
  constructor(
    @InjectRepository(KvEntity)
    private readonly repo: Repository<KvEntity>,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      // Протухло: удаляем в фоне (не держим read-путь вторым round-trip'ом).
      void this.repo.delete({ key }).catch(() => undefined);
      return null;
    }
    return row.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.repo.upsert({ key, value, expiresAt }, ['key']);
  }

  /**
   * Атомарный захват: вставить, либо перезаписать ТОЛЬКО если запись истекла.
   * Возвращает true, если ключ захвачен (вставлен/перезаписан истёкший).
   */
  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const rows = await this.repo.query(
      `INSERT INTO kv_store (key, value, "expiresAt") VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, "expiresAt" = EXCLUDED."expiresAt"
         WHERE kv_store."expiresAt" < now()
       RETURNING key`,
      [key, value, expiresAt],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async del(key: string): Promise<void> {
    await this.repo.delete({ key });
  }

  /**
   * Удалить протухшие записи (периодическая очистка). Возвращает кол-во.
   * Под advisory xact-lock: в multi-pod реально чистит только ОДИН под за цикл,
   * остальные сразу выходят (0) — без N конкурентных DELETE. Лок снимается на
   * commit транзакции.
   *
   * DELETE ОГРАНИЧЕН (LIMIT по ctid): один прогон удаляет не более CLEANUP_BATCH
   * строк — иначе при большом накопившемся бэклоге (если очистка падала) один
   * неограниченный DELETE держал бы соединение/лок и раздувал WAL произвольно
   * долго. Остаток дочистится на следующем тике cron.
   */
  async deleteExpired(): Promise<number> {
    return this.repo.manager.transaction(async (em) => {
      const lock: Array<{ locked: boolean }> = await em.query(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [KV_CLEANUP_LOCK_KEY],
      );
      if (!lock?.[0]?.locked) return 0; // другой под уже чистит
      // RETURNING → надёжный счётчик (длина массива строк), без парсинга
      // драйвер-специфичного формата результата DELETE.
      const rows: unknown = await em.query(
        `DELETE FROM kv_store WHERE ctid IN (
           SELECT ctid FROM kv_store WHERE "expiresAt" < now() LIMIT $1
         ) RETURNING key`,
        [CLEANUP_BATCH],
      );
      return Array.isArray(rows) ? rows.length : 0;
    });
  }
}

/** Потолок строк на один прогон очистки (бэклог дочищается следующими тиками). */
const CLEANUP_BATCH = 10_000;

/** Произвольный ключ advisory-лока для координации очистки между подами. */
const KV_CLEANUP_LOCK_KEY = 4242;
