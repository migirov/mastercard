import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Which tenant owns which Mastercard transaction — the authoritative LOCAL resource→tenant
 * binding for PLATFORM-mode merchants.
 *
 * Why it has to exist: every PLATFORM tenant resolves to the SAME MC `partnerId` (they are
 * logical sub-accounts of one partner account), so Mastercard cannot tell them apart. Ask MC
 * for a payment by `transaction_reference` and it answers for the whole partner account,
 * regardless of which sub-merchant created it. Without a local binding, any PLATFORM tenant
 * can read — and cancel — a peer's payments and quotes. OWN tenants each have their own
 * `partnerId`, so MC isolates them upstream and this table is not consulted for them.
 *
 * Distinct from `payment_idempotency` on purpose. That table is the double-charge lock: its
 * row is written BEFORE the MC call and is a claim of intent, not proof of ownership (a row
 * exists while the call is in flight, and permanently if it 5xx'd). This table records what
 * actually completed, and is the only thing an authorization check may trust.
 *
 * Row semantics:
 *   - `refHash`      — sha256(transaction_reference). The client's ref is arbitrary in
 *                      length/charset, so it is hashed; `tenantId` scopes it.
 *   - `mcPaymentId`  — NULL until a payment succeeds. Quote claims are written first (a
 *                      confirmation happens before any payment exists) and are back-filled
 *                      with the id when the payment completes.
 */
@Entity('tx_ownership')
@Unique('UQ_tx_ownership_tenant_ref', ['tenantId', 'refHash'])
export class TransactionOwnershipEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  /** sha256(transaction_reference) — 64 hex. */
  @Column({ type: 'varchar', length: 64 })
  refHash!: string;

  /**
   * The MC-assigned payment id (e.g. `rem_<43 url-safe chars>`), NULL until a payment
   * completes. Indexed because `getPayment`/`cancelPayment` address a payment by this id
   * and must resolve it back to an owner. The index is created PARTIAL (`WHERE NOT NULL`)
   * in the migration — most rows are NULL and TypeORM cannot express the predicate here.
   */
  @Index('IDX_tx_ownership_mc_payment_id')
  @Column({ type: 'varchar', length: 128, nullable: true })
  mcPaymentId?: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
