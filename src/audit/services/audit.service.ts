import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';

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
// Потолок буфера при ретраях: если БД лежит, держим до стольки записей и не
// растём в OOM (избыток отбрасываем). 10× MAX_BUFFER ≈ 10с трафика на пике.
const MAX_RETAINED = MAX_BUFFER * 10;

/**
 * Журнал операций в PostgreSQL (общий для всех подов). Запись — fire-and-forget
 * + **батчинг**: накапливаем в буфере и пишем пачкой (раз в секунду / по 100
 * записей / на shutdown), чтобы не делать отдельный INSERT на каждый запрос.
 * Компромисс: при жёстком краше теряется ≤1с незаписанного аудита (не
 * транзакционные данные). Параллельно — немедленный структурный лог в stdout.
 */
@Injectable()
export class AuditService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger('Audit');
  private buffer: AuditEntry[] = [];
  private timer?: NodeJS.Timeout;
  /** In-flight flush: гард ре-энтерабельности (см. flush()). */
  private flushing?: Promise<void>;
  /** Backoff при затяжном отказе БД: число подряд провалившихся вставок и
   *  момент (ms), до которого периодический флаш пропускаем (см. doFlush). */
  private consecutiveFailures = 0;
  private backoffUntilMs = 0;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  /** Таймер периодического сброса запускаем в lifecycle-хуке, а НЕ в конструкторе
   *  (конструктор без side-effect'ов — конвенция Nest; иначе таймер тикал бы ещё
   *  до полной инициализации модуля). */
  onModuleInit(): void {
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
    // Кап и на УСПЕШНОМ пути: если флаш МЕДЛЕННЫЙ (не падает), re-entrancy-гард
    // делает последующие flush() no-op, а record() продолжает пушить — без капа
    // буфер рос бы неограниченно под нагрузкой при тормозящей БД.
    this.capBuffer();
  }

  /** Ограничивает буфер сверху, отбрасывая САМЫЕ СТАРЫЕ записи (см. doFlush). */
  private capBuffer(): void {
    if (this.buffer.length > MAX_RETAINED) {
      const dropped = this.buffer.length - MAX_RETAINED;
      this.buffer.splice(0, dropped);
      this.logger.warn(`audit buffer over cap: dropped ${dropped} oldest`);
    }
  }

  /**
   * Сбросить буфер в БД одной пачкой. Ре-энтерабельность: flush() зовётся из 4
   * мест (таймер, MAX_BUFFER-триггер, recent(), shutdown) — при наложении второй
   * вызов НЕ запускает параллельную вставку (иначе батчи могли бы продублироваться
   * или переупорядочиться), а ждёт уже идущий флаш.
   */
  /**
   * @param force игнорировать backoff-окно (shutdown/recent() должны флашить всегда).
   */
  private flush(force = false): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return Promise.resolve();
    // При затяжном отказе БД не долбим её каждую секунду полным батчем (storm +
    // лог-спам именно когда БД уже плохо). Принудительный флаш backoff игнорирует.
    if (!force && Date.now() < this.backoffUntilMs) return Promise.resolve();
    this.flushing = this.doFlush().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async doFlush(): Promise<void> {
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
      // Успех — снимаем backoff.
      this.consecutiveFailures = 0;
      this.backoffUntilMs = 0;
    } catch (err) {
      // Транзиентная ошибка БД (deadlock/failover/блип): возвращаем батч в буфер,
      // чтобы следующий тик повторил вставку — иначе записи терялись бы навсегда,
      // даже когда под продолжает работать. Кап отбрасывает САМЫЕ СТАРЫЕ: при
      // затяжном сбое важнее сохранить свежие события (их и расследуют).
      this.buffer.unshift(...batch);
      this.capBuffer();
      // Экспоненциальный backoff с потолком 60с: при durable-сбое БД повторяем
      // вставку всё реже, а не каждую секунду (буфер всё равно ограничен capBuffer).
      this.consecutiveFailures += 1;
      const backoffMs = Math.min(2 ** this.consecutiveFailures, 60) * 1000;
      this.backoffUntilMs = Date.now() + backoffMs;
      this.logger.error(
        `audit batch insert failed (${batch.length} rows, retry in ${backoffMs / 1000}s): ${(err as Error).message}`,
      );
    }
  }

  // Флашим в beforeApplicationShutdown — это ФАЗА РАНЬШE onApplicationShutdown, в
  // которой @nestjs/typeorm закрывает соединение. Иначе буфер сбрасывался бы уже
  // после разрыва коннекта (ошибка «Connection terminated», потеря записей).
  async beforeApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // Двойной флаш, как в recent(): если на момент shutdown шёл флаш по таймеру,
    // первый await вернул ЕГО промис (re-entrancy-гард), а записи, добавленные
    // во время него, остались бы в буфере и потерялись на остановке — добиваем
    // их вторым флашем (гард уже снят → реальная вставка). force=true: на остановке
    // пробуем записать даже в backoff-окне (последний шанс сохранить буфер).
    await this.flush(true);
    if (this.buffer.length > 0) await this.flush(true);
  }

  async recent(limit = 100): Promise<AuditEntry[]> {
    // чтобы /admin/audit отражал и ещё не сброшенные записи. Если флаш уже шёл,
    // первый await вернул ЕГО промис (re-entrancy-гард), а записи, накопленные
    // за время того флаша, остались в буфере — добиваем их вторым флашем (гард
    // снят → реальная вставка). Гарантия best-effort: записи, добавленные уже во
    // время ВТОРОГО флаша, попадут в выборку лишь на следующем вызове — для
    // debug-вью /admin/audit это приемлемо (в БД они не теряются, ждут таймер).
    // force=true: вью аудита должно отражать буфер даже в backoff-окне.
    await this.flush(true);
    if (this.buffer.length > 0) await this.flush(true);
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
