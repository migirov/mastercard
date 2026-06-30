import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CredentialMode, Tenant } from '../tenant.types';

/** Partner/merchant. The source of truth is Postgres (shared across all pods). */
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

  // The secret is NEVER exposed externally. @Exclude — protection at the source: on any
  // serialization of the entity (ClassSerializerInterceptor / instanceToPlain) the field
  // is dropped. It does not affect TypeORM persistence or reads in business logic
  // (CredentialsService still sees secretRef in memory).
  @Exclude()
  @Column({ type: 'varchar', length: 256, nullable: true })
  secretRef?: string;

  @Column({ type: 'boolean', default: false })
  platformApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  mcApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  suspended!: boolean;

  // list() sorts by createdAt ASC — an index for that order. The schema is managed by
  // migrations ONLY (synchronize is not used): the index lands in a migration via
  // migration:generate from the entity metadata. In prod the host runs the migrations.
  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
