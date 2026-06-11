import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** OAuth2-клиент партнёра. Секрет хранится только хэшем. */
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
