import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Partner OAuth2 client. The secret is stored only as a hash. */
@Entity('oauth_clients')
export class OAuthClientEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  clientId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 128 })
  secretHash!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
