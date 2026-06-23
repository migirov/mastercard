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

const FLUSH_INTERVAL_MS = 1000; // periodic buffer flush
const MAX_BUFFER = 100; // forced flush when full
// Buffer ceiling under retries: if the DB is down, retain up to this many records and do
// not grow into OOM (the excess is dropped). 10× MAX_BUFFER ≈ 10s of traffic at peak.
const MAX_RETAINED = MAX_BUFFER * 10;

/**
 * Operations log in PostgreSQL (shared across all pods). Writes are fire-and-forget
 * + **batched**: accumulated in a buffer and written in a batch (once a second / per 100
 * records / on shutdown), to avoid a separate INSERT per request. Trade-off: a hard crash
 * loses ≤1s of unwritten audit (non-transactional data). In parallel — an immediate
 * structured log to stdout.
 */
@Injectable()
export class AuditService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger('Audit');
  private buffer: AuditEntry[] = [];
  private timer?: NodeJS.Timeout;
  /** In-flight flush: re-entrancy guard (see flush()). */
  private flushing?: Promise<void>;
  /** Backoff on prolonged DB failure: the count of consecutive failed inserts and
   *  the moment (ms) until which the periodic flush is skipped (see doFlush). */
  private consecutiveFailures = 0;
  private backoffUntilMs = 0;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  /** The periodic-flush timer is started in a lifecycle hook, NOT in the constructor
   *  (a side-effect-free constructor is a Nest convention; otherwise the timer would tick
   *  before the module is fully initialized). */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    // don't keep the event loop alive because of the timer
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
    // Cap on the SUCCESS path too: if a flush is SLOW (not failing), the re-entrancy guard
    // makes subsequent flush() calls a no-op while record() keeps pushing — without the cap
    // the buffer would grow unbounded under load when the DB is slow.
    this.capBuffer();
  }

  /** Caps the buffer from above, dropping the OLDEST records (see doFlush). */
  private capBuffer(): void {
    if (this.buffer.length > MAX_RETAINED) {
      const dropped = this.buffer.length - MAX_RETAINED;
      this.buffer.splice(0, dropped);
      this.logger.warn(`audit buffer over cap: dropped ${dropped} oldest`);
    }
  }

  /**
   * Flush the buffer to the DB in a single batch. Re-entrancy: flush() is called from 4
   * places (timer, MAX_BUFFER trigger, recent(), shutdown) — when they overlap, the second
   * call does NOT start a parallel insert (otherwise batches could be duplicated or
   * reordered) but waits for the flush already in progress.
   */
  /**
   * @param force ignore the backoff window (shutdown/recent() must always flush).
   */
  private flush(force = false): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return Promise.resolve();
    // On prolonged DB failure don't hammer it every second with the full batch (storm +
    // log spam exactly when the DB is already unhealthy). A forced flush ignores backoff.
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
      // Success — clear the backoff.
      this.consecutiveFailures = 0;
      this.backoffUntilMs = 0;
    } catch (err) {
      // Transient DB error (deadlock/failover/blip): return the batch to the buffer so the
      // next tick retries the insert — otherwise records would be lost forever, even while
      // the pod keeps running. The cap drops the OLDEST: on a prolonged failure it is more
      // important to keep the freshest events (those are what gets investigated).
      this.buffer.unshift(...batch);
      this.capBuffer();
      // Exponential backoff capped at 60s: on a durable DB failure retry the insert ever
      // less often, not every second (the buffer is bounded by capBuffer anyway).
      this.consecutiveFailures += 1;
      const backoffMs = Math.min(2 ** this.consecutiveFailures, 60) * 1000;
      this.backoffUntilMs = Date.now() + backoffMs;
      this.logger.error(
        `audit batch insert failed (${batch.length} rows, retry in ${backoffMs / 1000}s): ${(err as Error).message}`,
      );
    }
  }

  // We flush in beforeApplicationShutdown — this is the PHASE BEFORE onApplicationShutdown,
  // in which @nestjs/typeorm closes the connection. Otherwise the buffer would be flushed
  // after the connection is torn down ("Connection terminated" error, lost records).
  async beforeApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // Double flush, as in recent(): if a timer flush was in progress at shutdown, the first
    // await returned ITS promise (re-entrancy guard), and records added during it would
    // remain in the buffer and be lost on stop — we drain them with a second flush (the
    // guard is now released → a real insert). force=true: on stop we try to write even
    // inside the backoff window (last chance to persist the buffer).
    await this.flush(true);
    if (this.buffer.length > 0) await this.flush(true);
  }

  async recent(limit = 100): Promise<AuditEntry[]> {
    // so /admin/audit reflects not-yet-flushed records too. If a flush was already in
    // progress, the first await returned ITS promise (re-entrancy guard), and records
    // accumulated during that flush remain in the buffer — we drain them with a second
    // flush (guard released → a real insert). Best-effort guarantee: records added during
    // the SECOND flush appear in the result only on the next call — for the /admin/audit
    // debug view this is acceptable (they are not lost in the DB, they wait for the timer).
    // force=true: the audit view must reflect the buffer even inside the backoff window.
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
