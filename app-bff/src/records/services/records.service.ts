import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordEntity } from '../entities/record.entity';

/** A "RecordView": the stored document merged with id + timestamps. */
export type RecordView = Record<string, unknown> & {
  id: string;
  created_date: Date;
  updated_date: Date;
};

/** Columns sorted on the table itself rather than the jsonb document. */
const TIMESTAMP_COLUMNS = new Set(['created_date', 'updated_date']);

/** Row caps for `list`: always bounded so a missing/`0`/`NaN` limit can't dump the table. */
const LIMIT_DEFAULT = 200;
const LIMIT_MAX = 500;

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly repo: Repository<RecordEntity>,
  ) {}

  /** Merge the row into the object shape the frontend expects. */
  private view(rec: RecordEntity): RecordView {
    return {
      ...rec.data,
      id: rec.id,
      created_date: rec.created_date,
      updated_date: rec.updated_date,
    };
  }

  /**
   * `Entity.list(sort, limit)`. `sort` is a field name optionally prefixed
   * with `-` for descending (e.g. `-created_date`, `-date`). Timestamp columns sort
   * on the column; any other field sorts on the jsonb document (`data->>field`,
   * NULLS LAST). Default order is `created_date` DESC.
   */
  async list(
    entityType: string,
    sort?: string,
    limit?: number,
  ): Promise<RecordView[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.entityType = :t', { t: entityType });

    if (sort) {
      const desc = sort.startsWith('-');
      const field = desc ? sort.slice(1) : sort;
      const dir = desc ? 'DESC' : 'ASC';
      if (TIMESTAMP_COLUMNS.has(field)) {
        qb.orderBy(`r.${field}`, dir);
      } else {
        // Order by a document field; NULLS LAST keeps records missing it at the end.
        qb.orderBy(`r.data ->> :sf`, dir, 'NULLS LAST').setParameter(
          'sf',
          field,
        );
      }
    } else {
      qb.orderBy('r.created_date', 'DESC');
    }
    const cap =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), LIMIT_MAX)
        : LIMIT_DEFAULT;
    qb.limit(cap);
    const rows = await qb.getMany();
    return rows.map((r) => this.view(r));
  }

  async get(entityType: string, id: string): Promise<RecordView> {
    const rec = await this.repo.findOne({ where: { entityType, id } });
    if (!rec) throw new NotFoundException(`${entityType} '${id}' not found`);
    return this.view(rec);
  }

  async create(
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<RecordView> {
    const rec = this.repo.create({ entityType, data: stripMeta(data) });
    const saved = await this.repo.save(rec);
    return this.view(saved);
  }

  /** `update` SHALLOW-merges the patch into the existing document. */
  async update(
    entityType: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<RecordView> {
    const rec = await this.repo.findOne({ where: { entityType, id } });
    if (!rec) throw new NotFoundException(`${entityType} '${id}' not found`);
    rec.data = { ...rec.data, ...stripMeta(patch) };
    // Set explicitly (the column has no @UpdateDateColumn) so a patch always bumps it.
    rec.updated_date = new Date();
    const saved = await this.repo.save(rec);
    return this.view(saved);
  }

  async remove(entityType: string, id: string): Promise<{ id: string }> {
    const res = await this.repo.delete({ entityType, id });
    // Be consistent with get/update: a missing id is a 404, not a silent 200.
    if (!res.affected)
      throw new NotFoundException(`${entityType} '${id}' not found`);
    return { id };
  }

  /** Count for an entity type — used by the seeder to avoid double-seeding. */
  count(entityType: string): Promise<number> {
    return this.repo.countBy({ entityType });
  }
}

/** Never let callers overwrite the managed id/timestamps inside the jsonb document. */
function stripMeta(data: Record<string, unknown>): Record<string, unknown> {
  const { id, created_date, updated_date, ...rest } = data ?? {};
  void id;
  void created_date;
  void updated_date;
  return rest;
}
