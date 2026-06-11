import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CredentialMode, Tenant } from '../../tenants/tenant.types';

/** Партнёр/мерчант. Источник истины — Postgres (общий для всех подов). */
@Entity('tenants')
export class TenantEntity implements Tenant {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  credentialMode!: CredentialMode;

  @Column({ type: 'varchar', length: 128, nullable: true })
  partnerId?: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  secretRef?: string;

  @Column({ type: 'boolean', default: false })
  platformApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  mcApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  suspended!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
