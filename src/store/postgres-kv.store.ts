import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KvEntity } from '../database/entities/kv.entity';
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

  /** Удалить все протухшие записи (периодическая очистка). Возвращает кол-во. */
  async deleteExpired(): Promise<number> {
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < now()')
      .execute();
    return res.affected ?? 0;
  }
}
