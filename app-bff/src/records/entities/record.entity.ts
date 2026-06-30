import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One generic table for ALL entity types (Invoice, VirtualCard, Employee, …).
 * These entities are schemaless JSON documents with id + created_date + updated_date,
 * so we store the variable fields in a single jsonb `data` column keyed by `entityType`.
 * This keeps the demo store trivially flexible — no migration per entity shape.
 *
 * The schema is migrations-only (see `database/migrations`); this metadata must match
 * the `InitialSchema` migration exactly. The timestamp columns are plain `@Column`s
 * (default now(), set on insert), NOT `@CreateDateColumn`/`@UpdateDateColumn`: the
 * service updates `updated_date` explicitly on patch so the value is deterministic and
 * the migration owns the DDL.
 */
@Entity('records')
@Index('IDX_records_entityType', ['entityType'])
export class RecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  entityType!: string;

  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'created_date', default: () => 'now()' })
  created_date!: Date;

  @Column({ type: 'timestamptz', name: 'updated_date', default: () => 'now()' })
  updated_date!: Date;
}
