import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persists MC push notifications — the single source of truth for webhook processing (no
 * KV layer). Status events (Status Change / Quote Status Change) carry status/stage and are
 * read by the merchant; others (Carded Rate / RFI) sit there for dedup+audit.
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

  // Projection columns (eventType/transactionType/status/stage): convenience fields
  // pulled from arbitrary spots of the MC payload and NOT length-validated by the DTO.
  // They are `text` (no width) on purpose — so there is nothing to overflow (no
  // "value too long" → 500 → broken "always 200" webhook contract) and nothing to
  // truncate in the store. The full event is preserved in `payload` (jsonb) regardless,
  // and these columns are not indexed, so an over-long value costs nothing extra.
  @Column({ type: 'text', nullable: true })
  eventType?: string | null;

  /** QUOTE | PAYMENT (from the event's transactionType). */
  @Column({ type: 'text', nullable: true })
  transactionType?: string | null;

  @Column({ type: 'text', nullable: true })
  status?: string | null;

  @Column({ type: 'text', nullable: true })
  stage?: string | null;

  /** Сырое (нормализованное) событие целиком — чтобы не потерять доп. поля MC. */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}
