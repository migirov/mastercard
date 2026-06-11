import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Универсальное KV-хранилище с TTL (идемпотентность, дедуп вебхуков).
 * Персистентно и согласованно между подами.
 */
@Entity('kv_store')
export class KvEntity {
  @PrimaryColumn({ type: 'varchar', length: 256 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
