import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sha256hex } from '../../../common/utils/crypto.util';
import { CredentialMode, Tenant } from '../../../tenants/tenant.types';
import { TransactionOwnershipEntity } from '../entities/transaction-ownership.entity';

/** MC payment ids observed as `rem_<43 url-safe chars>`; cap with headroom for drift. */
const MAX_MC_PAYMENT_ID = 128;

/**
 * Authorizes a tenant's access to a Mastercard transaction it addresses by a client-chosen
 * `transaction_reference` or by the MC-assigned payment id.
 *
 * Only PLATFORM tenants are gated: they share one MC partner account, so upstream cannot
 * attribute a resource to a sub-merchant and the binding must be maintained here. OWN tenants
 * have their own `partnerId` and are already isolated by Mastercard — the gate is a no-op for
 * them, and must stay that way so single-tenant and OWN deployments are unaffected.
 */
@Injectable()
export class TransactionOwnership {
  private readonly logger = new Logger(TransactionOwnership.name);

  constructor(
    @InjectRepository(TransactionOwnershipEntity)
    private readonly repo: Repository<TransactionOwnershipEntity>,
  ) {}

  /**
   * The ONE derivation of a reference's storage key. `PaymentsService.idemKey` builds its own
   * key on top of this (`txref:` + refHash) — the two must never be conflated: a quote claim
   * written under the payment's idempotency key would make the follow-up payment collide with
   * itself and 422 on a fingerprint mismatch.
   */
  refHash(ref: string): string {
    return sha256hex(ref);
  }

  /**
   * Record that this tenant owns the reference. Idempotent.
   *
   * Best-effort by design: a claim-write failure must never fail an operation that already
   * succeeded at Mastercard. The cost of a lost claim is a later 404 the tenant can resolve by
   * retrying; the cost of throwing here would be a merchant seeing an error for a payment that
   * actually went through.
   */
  async claim(tenant: Tenant, ref: string | undefined): Promise<void> {
    await this.upsert(tenant, ref, undefined);
  }

  /** Claim the reference and attach the MC-assigned payment id. Best-effort, as `claim`. */
  async recordPayment(
    tenant: Tenant,
    ref: string | undefined,
    mcPaymentId: string | undefined,
  ): Promise<void> {
    await this.upsert(tenant, ref, mcPaymentId);
  }

  /** Raw predicate for callers that need a boolean rather than a throw. */
  async hasClaim(tenantId: string, ref: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { tenantId, refHash: this.refHash(ref) },
    });
    return count > 0;
  }

  /**
   * Gate on a `transaction_reference`. OWN → no-op. PLATFORM → must hold a claim.
   *
   * An absent/empty ref throws rather than falling through: "cannot prove ownership" is not
   * "is allowed", and falling through would make the gate a one-character bypass.
   */
  async assertOwnsRef(tenant: Tenant, ref: string | undefined): Promise<void> {
    if (tenant.credentialMode !== CredentialMode.PLATFORM) return;
    if (!ref || !(await this.hasClaim(tenant.id, ref))) {
      throw this.notFound();
    }
  }

  /** Same gate, keyed on the MC-assigned payment id. */
  async assertOwnsPaymentId(
    tenant: Tenant,
    mcPaymentId: string,
  ): Promise<void> {
    if (tenant.credentialMode !== CredentialMode.PLATFORM) return;
    const count = mcPaymentId
      ? await this.repo.count({ where: { tenantId: tenant.id, mcPaymentId } })
      : 0;
    if (count === 0) throw this.notFound();
  }

  /**
   * 404, never 403. A 403 on a foreign reference would confirm that it exists and belongs to
   * someone else — an enumeration oracle over a guessable, client-chosen string. "Not found"
   * makes "never existed" and "not yours" indistinguishable.
   */
  private notFound(): NotFoundException {
    return new NotFoundException('Transaction not found');
  }

  private async upsert(
    tenant: Tenant,
    ref: string | undefined,
    mcPaymentId: string | undefined,
  ): Promise<void> {
    if (!ref) return;
    try {
      await this.repo.query(
        `INSERT INTO tx_ownership ("tenantId", "refHash", "mcPaymentId", "createdAt")
         VALUES ($1, $2, $3, now())
         ON CONFLICT ("tenantId", "refHash") DO UPDATE
           SET "mcPaymentId" = COALESCE(EXCLUDED."mcPaymentId", tx_ownership."mcPaymentId")`,
        [tenant.id, this.refHash(ref), normalizeMcPaymentId(mcPaymentId)],
      );
    } catch (err) {
      // COALESCE order matters above: a response that omits the id must not blank one we
      // already stored (a payment replay returns the cached body, which may differ in shape).
      this.logger.error(
        `tx_ownership: failed to record ownership for tenant '${tenant.id}': ${(err as Error).message}`,
      );
    }
  }
}

/** Reject anything that is not a usable id, so a bad shape stores NULL rather than junk. */
function normalizeMcPaymentId(v: string | undefined): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed && trimmed.length <= MAX_MC_PAYMENT_ID ? trimmed : null;
}

/**
 * Pull the MC-assigned payment id out of a payment response.
 *
 * Deliberately defensive: the response is an opaque passthrough of Mastercard's schema, and a
 * shape we do not recognise must yield `undefined` (→ NULL, → the by-id route 404s for that
 * payment) rather than throw and fail a payment that already succeeded. The by-ref route and
 * status-events still work in that case, so a working path always remains.
 */
export function extractMcPaymentId(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const r = res as Record<string, unknown>;
  const payment = r.payment as Record<string, unknown> | undefined;
  const candidate =
    payment && typeof payment === 'object' ? payment.id : undefined;
  const id = typeof candidate === 'string' ? candidate : r.id;
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  return trimmed && trimmed.length <= MAX_MC_PAYMENT_ID ? trimmed : undefined;
}
