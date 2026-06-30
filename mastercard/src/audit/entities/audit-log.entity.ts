import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** An operations-log record (no bodies and no secrets). */
@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'timestamptz' })
  ts!: Date;

  // Deliberately NOT an FK to tenants: the audit trail is a forensic record that must
  // survive a tenant's deletion (and capture pre-onboarding / unattributed calls where
  // tenantId is NULL). Indexed for lookup; integrity is intentionally not enforced here.
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
