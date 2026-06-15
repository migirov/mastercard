import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Персист статусных push-уведомлений MC (Status Change / Quote Status Change).
 *
 * `eventRef` UNIQUE → дедуп И запись атомарны (один `INSERT ... ON CONFLICT
 * DO NOTHING`), что снимает риск «жёсткий краш между пометкой дедупа и записью
 * статуса» (бывший TODO в WebhookHandler). `eventRef` nullable: если у события
 * нет ref, дедуп невозможен — Postgres считает NULL'ы РАЗЛИЧНЫМИ, поэтому такие
 * строки всегда вставляются (а не конфликтуют между собой).
 *
 * `tenantId` nullable по решению по привязке: для OWN-тенанта резолвится по
 * `partnerId`; для PLATFORM (общий partner-id, однозначно тенанта не определить)
 * — NULL (общий пул, читается мерчантом по transaction_reference).
 */
// Индекс ведёт transactionReference: единственный путь чтения — по ref
// (`findForTenant`), tenantId — вторичный фильтр. Ref-leading индекс обслуживает
// и «по ref», и «по ref+tenant».
@Entity('tx_status')
@Index(['transactionReference', 'tenantId'])
export class TransactionStatusEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  eventRef?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  transactionReference?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  eventType?: string | null;

  /** QUOTE | PAYMENT (из transactionType события). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  transactionType?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  stage?: string | null;

  /** Сырое (нормализованное) событие целиком — чтобы не потерять доп. поля MC. */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}
