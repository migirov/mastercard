import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CredentialMode, Tenant } from './tenant.types';

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

  // Секрет наружу не отдаём НИКОГДА. @Exclude — защита у источника: при любой
  // сериализации сущности (ClassSerializerInterceptor / instanceToPlain) поле
  // выпадает. Не влияет на TypeORM-персистентность и чтение в бизнес-логике
  // (CredentialsService по-прежнему видит secretRef в памяти).
  @Exclude()
  @Column({ type: 'varchar', length: 256, nullable: true })
  secretRef?: string;

  @Column({ type: 'boolean', default: false })
  platformApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  mcApproved!: boolean;

  @Column({ type: 'boolean', default: false })
  suspended!: boolean;

  // list() сортирует по createdAt ASC — индекс под этот порядок. В dev создаётся
  // через synchronize; в проде хост подхватывает его из метаданных entity при
  // migration:generate (схему в проде ведёт хост, не synchronize).
  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
