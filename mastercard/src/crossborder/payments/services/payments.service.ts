import { Injectable } from '@nestjs/common';
import { sha256hex } from '../../../common/utils/crypto.util';
import { stableStringify } from '../../../common/utils/canonical-json.util';
import { CredentialMode } from '../../../tenants/tenant.types';
import { TransactionStatusStore } from '../../../webhooks/services/transaction-status.store';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import {
  TransactionOwnership,
  extractMcPaymentId,
} from '../../common/ownership/transaction-ownership.service';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { StatusEventViewDto } from '../dto/status-event-view.dto';
import { PaymentIdempotencyStore } from './payment-idempotency.store';

/** Cross-Border payments: initiate, look up, cancel, and read pushed statuses. */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly gw: CrossBorderGateway,
    private readonly idempotency: PaymentIdempotencyStore,
    private readonly statusEvents: TransactionStatusStore,
    private readonly ownership: TransactionOwnership,
  ) {}

  /**
   * Initiate a payment (POST). Idempotency is keyed on `transaction_reference` (same ref =
   * same transaction), backed by Postgres. The body is encrypted in MTF/Prod, same as quote.
   */
  async createPayment(tenantId: string, body: PaymentRequestDto) {
    // Resolve credentials (gating + a possibly slow SecretStore) BEFORE claiming the
    // idempotency lock: the producer inside the lock must be bounded only by MC's 30s
    // timeout (≪ LOCK_TTL 120s), otherwise a slow secret store could stretch the producer past the
    // TTL → another pod re-claims the lock → a double POST.
    const tenant = await this.gw.activeTenant(tenantId);
    const creds = await this.gw.credentialsFor(tenant);
    // Idempotency by `transaction_reference` — the payment's business key and source of
    // truth: it's mandatory at MC and MC dedups on it. A retry with the same
    // `transaction_reference` → the same result WITHOUT re-calling MC (double-charge
    // protection); the state lives in Postgres (`payment_idempotency`), not in KV. The key
    // is hashed (ref is an arbitrary client string → bounded for the idemKey column). Body
    // fingerprint: same ref with a DIFFERENT body → 422 (protects against payment swap).
    // No ref → MC rejects the payment anyway (field is mandatory) → no idempotency.
    const ref = body?.paymentrequest?.transaction_reference;
    const idemKey = ref ? this.idemKey(ref) : undefined;
    // Canonical (key-sorted) serialization, NOT raw JSON.stringify: a legitimate retry of
    // the same payment may re-serialize the body with keys in a different order (client SDK,
    // proxy, JSON round-trip). Hashing the canonical form makes a key-reordered-but-identical
    // body fingerprint the same → it replays instead of being rejected as "different body"
    // (422). A genuinely different payment still differs after sorting → still 422.
    const fingerprint = sha256hex(stableStringify(body));
    const result = await this.idempotency.run(
      tenantId,
      idemKey,
      () =>
        this.gw.call(
          creds,
          {
            method: 'POST',
            path: mcPath.payment(this.gw.partner(creds)),
            body,
          },
          'createPayment',
        ),
      fingerprint,
    );
    // Record ownership only once MC has accepted the payment. The try/catch is deliberate
    // belt-and-braces: `recordPayment` already swallows its own DB errors, but the money has
    // MOVED by this point, so nothing in this bookkeeping step may be allowed to surface as
    // a failed payment — not a DB error, not a bug, not a future refactor of the collaborator.
    try {
      await this.ownership.recordPayment(
        tenant,
        ref,
        extractMcPaymentId(result),
      );
    } catch {
      // Already logged inside the store; the payment stands.
    }
    return result;
  }

  /**
   * Payment status by transaction id (GET). id is already validated by SafeIdPipe.
   * PLATFORM tenants share one MC partner account, so the id alone does not identify an
   * owner — gate on the local binding before asking MC (see TransactionOwnership).
   */
  async getPayment(tenantId: string, paymentId: string) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsPaymentId(tenant, paymentId);
    return this.gw.runFor(tenant, 'getPayment', (c) => ({
      method: 'GET',
      path: mcPath.paymentById(this.gw.partner(c), paymentId),
    }));
  }

  /** Payment status by transaction reference (GET ?ref=). ref is validated by SafeIdPipe. */
  async getPaymentByRef(tenantId: string, ref: string) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsRef(tenant, ref);
    return this.gw.runFor(tenant, 'getPaymentByRef', (c) => ({
      method: 'GET',
      path: mcPath.paymentByRef(this.gw.partner(c), ref),
    }));
  }

  /** Cancel a payment (POST). id is already validated by SafeIdPipe in the controller. */
  async cancelPayment(tenantId: string, paymentId: string) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsPaymentId(tenant, paymentId);
    return this.gw.runFor(tenant, 'cancelPayment', (c) => ({
      method: 'POST',
      path: mcPath.cancelPayment(this.gw.partner(c), paymentId),
    }));
  }

  /**
   * Idempotency key for a transaction_reference (hashed → bounded for the column).
   *
   * Shares its hash with `TransactionOwnership.refHash` but is deliberately a DIFFERENT key:
   * `payment_idempotency` is the double-charge lock, `tx_ownership` is the authorization
   * binding. Writing a quote claim under this key would make the follow-up payment collide
   * with itself (`acquire` returns false → `assertSameBody` compares a quote fingerprint
   * against a payment one → 422 on every payment that follows its own quote).
   */
  private idemKey(ref: string): string {
    return `txref:${this.ownership.refHash(ref)}`;
  }

  /**
   * Push statuses by transaction_reference from OUR DB (polling delivery of
   * Status Change Push). A local read, not an MC call. Isolation:
   *  - an OWN tenant sees STRICTLY its own events (its pushes are attributed by partnerId
   *    and never land in the shared pool);
   *  - a PLATFORM tenant shares ONE MC partner account, so its pushes cannot be attributed
   *    per-merchant and sit in the null pool keyed only by transaction_reference. Because
   *    that reference is a guessable client string, pool visibility is gated on a COMPLETED
   *    PAYMENT: the tenant may read a pooled event ONLY for a transaction it actually paid,
   *    proven by a `tx_ownership` row carrying an MC payment id — not by a bare quote claim,
   *    and not by guessing another merchant's reference. A quote alone must never unlock the
   *    shared pool (that is what `hasClaim` allowed and `hasCompletedClaim` closes).
   *
   * ref is already validated by SafeIdPipe in the controller. The tenant is re-read here
   * rather than taken from the auth context: the context is a snapshot from when the guard
   * ran and a JWT lives 15 minutes, so a suspended tenant would keep reading until its token
   * expired. This is also the ONE crossborder route that never reaches the gateway's own
   * gate (it is a local DB read), which is exactly why it needs its own.
   *
   * `unsuspendedTenant`, not `activeTenant`: reading one's own transaction history is not
   * transacting, so a tenant awaiting approval must not be locked out of it.
   */
  async getStatusEvents(
    tenantId: string,
    ref: string,
  ): Promise<StatusEventViewDto[]> {
    const tenant = await this.gw.unsuspendedTenant(tenantId);
    const includePool =
      tenant.credentialMode === CredentialMode.PLATFORM &&
      (await this.ownership.hasCompletedClaim(tenant.id, ref));
    const rows = await this.statusEvents.findForTenant(
      tenant.id,
      ref,
      includePool,
    );
    // Explicit mapping (whitelist): we do not expose internal id/tenantId outside.
    return rows.map((r) => ({
      transactionReference: r.transactionReference ?? null,
      eventType: r.eventType ?? null,
      transactionType: r.transactionType ?? null,
      status: r.status ?? null,
      stage: r.stage ?? null,
      receivedAt: r.receivedAt,
      payload: r.payload,
    }));
  }
}
