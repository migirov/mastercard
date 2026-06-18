import { Injectable } from '@nestjs/common';
import { sha256hex } from '../../../common/utils/crypto.util';
import { CredentialMode, Tenant } from '../../../tenants/tenant.types';
import { TransactionStatusStore } from '../../../webhooks/services/transaction-status.store';
import { mcPath } from '../../mc-paths';
import { CrossBorderGateway } from '../../gateway/cross-border.gateway';
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
  ) {}

  /**
   * Initiate a payment (POST). Idempotency is keyed on `transaction_reference` (same ref =
   * same transaction), backed by Postgres. The body is encrypted in MTF/Prod, same as quote.
   */
  async createPayment(tenantId: string, body: PaymentRequestDto) {
    // Resolve credentials (gating + a possibly slow SecretStore) BEFORE claiming the
    // idempotency lock: the producer inside the lock must be bounded only by MC's 30s
    // timeout (≪ LOCK_TTL 120s), otherwise a slow Vault could stretch the producer past the
    // TTL → another pod re-claims the lock → a double POST.
    const creds = await this.gw.resolveActive(tenantId);
    // Idempotency by `transaction_reference` — the payment's business key and source of
    // truth: it's mandatory at MC and MC dedups on it. A retry with the same
    // `transaction_reference` → the same result WITHOUT re-calling MC (double-charge
    // protection); the state lives in Postgres (`payment_idempotency`), not in KV. The key
    // is hashed (ref is an arbitrary client string → bounded for the idemKey column). Body
    // fingerprint: same ref with a DIFFERENT body → 422 (protects against payment swap).
    // No ref → MC rejects the payment anyway (field is mandatory) → no idempotency.
    const ref = body?.paymentrequest?.transaction_reference;
    const idemKey = ref ? `txref:${sha256hex(ref)}` : undefined;
    const fingerprint = sha256hex(JSON.stringify(body));
    return this.idempotency.run(
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
  }

  /** Статус платежа по transaction id (GET). id уже проверен SafeIdPipe в контроллере. */
  getPayment(tenantId: string, paymentId: string) {
    return this.gw.run(tenantId, 'getPayment', (c) => ({
      method: 'GET',
      path: mcPath.paymentById(this.gw.partner(c), paymentId),
    }));
  }

  /** Статус платежа по transaction reference (GET ?ref=). ref проверен SafeIdPipe. */
  getPaymentByRef(tenantId: string, ref: string) {
    return this.gw.run(tenantId, 'getPaymentByRef', (c) => ({
      method: 'GET',
      path: mcPath.paymentByRef(this.gw.partner(c), ref),
    }));
  }

  /** Отмена платежа (POST). id уже проверен SafeIdPipe в контроллере. */
  cancelPayment(tenantId: string, paymentId: string) {
    return this.gw.run(tenantId, 'cancelPayment', (c) => ({
      method: 'POST',
      path: mcPath.cancelPayment(this.gw.partner(c), paymentId),
    }));
  }

  /**
   * Push-статусы по transaction_reference из НАШЕЙ БД (polling-доставка
   * Status Change Push). Локальное чтение, не вызов MC. Изоляция: OWN-тенант
   * видит СТРОГО свои события; общий null-пул отдаём только PLATFORM-тенанту (у
   * OWN событий в пуле не бывает — они атрибутируются по partnerId). ref уже
   * проверен SafeIdPipe в контроллере. `tenant` берём из auth-контекста (mode уже
   * там — без лишнего запроса к реестру).
   */
  async getStatusEvents(
    tenant: Tenant,
    ref: string,
  ): Promise<StatusEventViewDto[]> {
    const includePool = tenant.credentialMode === CredentialMode.PLATFORM;
    const rows = await this.statusEvents.findForTenant(
      tenant.id,
      ref,
      includePool,
    );
    // Явный маппинг (whitelist): не отдаём внутренние id/tenantId наружу.
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
