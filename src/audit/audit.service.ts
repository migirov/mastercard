import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';

export interface AuditEntry {
  ts: string;
  tenantId?: string;
  source?: string;
  method: string;
  path: string;
  status: number;
  ms: number;
}

const FLUSH_INTERVAL_MS = 1000; // периодический сброс буфера
const MAX_BUFFER = 100; // принудительный сброс при заполнении

/**
 * Журнал операций в PostgreSQL (общий для всех подов). Запись — fire-and-forget
 * + **батчинг**: накапливаем в буфере и пишем пачкой (раз в секунду / по 100
 * записей / на shutdown), чтобы не делать отдельный INSERT на каждый запрос.
 * Компромисс: при жёстком краше теряется ≤1с незаписанного аудита (не
 * транзакционные данные). Параллельно — немедленный структурный лог в stdout.
 */
@Injectable()
export class AuditService implements BeforeApplicationShutdown {
  private readonly logger = new Logger('Audit');
  private buffer: AuditEntry[] = [];
  private readonly timer: NodeJS.Timeout;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    // не держим event loop живым из-за таймера
    this.timer.unref?.();
  }

  record(e: AuditEntry): void {
    this.buffer.push(e);
    this.logger.log(
      `${e.source ?? '-'} tenant=${e.tenantId ?? '-'} ${e.method} ${e.path} ` +
        `${e.status} ${e.ms}ms`,
    );
    if (this.buffer.length >= MAX_BUFFER) {
      void this.flush();
    }
  }

  /** Сбросить буфер в БД одной пачкой. */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.repo.insert(
        batch.map((e) => ({
          ts: new Date(e.ts),
          tenantId: e.tenantId,
          source: e.source,
          method: e.method,
          path: e.path,
          status: e.status,
          ms: e.ms,
        })),
      );
    } catch (err) {
      this.logger.error(
        `audit batch insert failed (${batch.length} rows): ${(err as Error).message}`,
      );
    }
  }

  // Флашим в beforeApplicationShutdown — это ФАЗА РАНЬШE onApplicationShutdown, в
  // которой @nestjs/typeorm закрывает соединение. Иначе буфер сбрасывался бы уже
  // после разрыва коннекта (ошибка «Connection terminated», потеря записей).
  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  async recent(limit = 100): Promise<AuditEntry[]> {
    // чтобы /admin/audit отражал и ещё не сброшенные записи
    await this.flush();
    const rows = await this.repo.find({ order: { id: 'DESC' }, take: limit });
    return rows.map((r) => ({
      ts: r.ts.toISOString(),
      tenantId: r.tenantId,
      source: r.source,
      method: r.method,
      path: r.path,
      status: r.status,
      ms: r.ms,
    }));
  }
}
