import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TenantEntity } from '../../tenants/entities/tenant.entity';

/** Partner OAuth2 client. The secret is stored only as a hash. */
@Entity('oauth_clients')
export class OAuthClientEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  clientId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  // An OAuth client always belongs to a real tenant — enforced by a DB foreign key
  // (ON DELETE RESTRICT: a tenant with live clients cannot be deleted; revoke them first).
  // Modeled as a relation so the entity stays the source of truth for `migration:generate`
  // (Issue #1 — migrations-only schema, entity metadata is authoritative). The scalar
  // `tenantId` above remains the working column; this relation reuses it via @JoinColumn.
  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: TenantEntity;

  @Column({ type: 'varchar', length: 128 })
  secretHash!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
