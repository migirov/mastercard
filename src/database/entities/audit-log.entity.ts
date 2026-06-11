import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Запись журнала операций (без тел и секретов). */
@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'timestamptz' })
  ts!: Date;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  source?: string;

  @Column({ type: 'varchar', length: 8 })
  method!: string;

  @Column({ type: 'varchar', length: 512 })
  path!: string;

  @Column({ type: 'int' })
  status!: number;

  @Column({ type: 'int' })
  ms!: number;
}
