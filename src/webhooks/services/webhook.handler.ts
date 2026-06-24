import { Injectable, Logger } from '@nestjs/common';
import { sha256hex } from '../../common/utils/crypto.util';
import { clipForLog } from '../../common/utils/sanitize.util';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { McWebhookEventDto } from '../dto/mc-webhook-event.dto';
import { TransactionStatusStore } from './transaction-status.store';

/** Event types that carry a transaction/quote status → we persist them. */
const STATUS_EVENT_TYPES = new Set(['STATUS_CHG', 'QUOTE_STATUS_CHG']);

/**
 * The first NON-EMPTY (after trim) string ref among the candidates, else undefined.
 * A `??` chain won't do: a field that arrives as an empty string `''` is NOT passed through
 * by `??` — and an empty ref would become the dedup key, collapsing ALL such events into a
 * single row (`UNIQUE(eventRef)`) → lost events.
 */
function firstRef(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

/** A normalized slice of an event (camelCase ⊕ snake_case → a single shape). */
interface NormalizedEvent {
  ref: string | null; // eventRef ?? notificationId — the dedup key
  eventType: string | null;
  partnerId: string | null;
  transactionReference: string | null;
  transactionType: string | null;
  status: string | null;
  stage: string | null;
  raw: Record<string, unknown>;
}

type Ack = { status: 'accepted' | 'duplicate' };

/**
 * Mastercard push-notification handling. The source of truth is PostgreSQL (`tx_status`),
 * there is no separate KV layer: all events are deduped via UNIQUE(eventRef).
 * - Status events (STATUS_CHG/QUOTE_STATUS_CHG) → persisted to `tx_status` with status/stage;
 *   dedup AND write are atomic (INSERT ON CONFLICT DO NOTHING).
 * - Other events (Carded Rate Push, RFI, etc.) → the same atomic dedup+audit in `tx_status`
 *   (without status/stage); business processing as needed.
 * - Encrypted push (`{encrypted_payload}`) → decrypted by the JWE `kid` (platform key, or
 *   an OWN tenant key when available) and processed like any other event; if it can't be
 *   decrypted, the raw envelope is PERSISTED to `tx_status` (`eventType='ENCRYPTED'`) BEFORE
 *   the ack — otherwise MC won't retry after 200 and the event is lost — then reprocessed
 *   once the key exists.
 * - MC sends fields in both camelCase and snake_case → we normalize both notations.
 */
@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private readonly statusStore: TransactionStatusStore,
    private readonly tenants: TenantRegistry,
    private readonly encryption: EncryptionService,
  ) {}

  async handle(event: McWebhookEventDto): Promise<Ack> {
    // Encrypted push (mTLS channel + JWE body). We try to decrypt by the JWE `kid` (the
    // platform key, or an OWN tenant key when available); on success we process the plain
    // event, otherwise we PERSIST the envelope BEFORE the ack — see handleEncrypted.
    if (this.isEncrypted(event)) {
      return this.handleEncrypted(event);
    }

    const n = this.normalize(event);

    if (n.eventType && STATUS_EVENT_TYPES.has(n.eventType)) {
      return this.handleStatus(n);
    }
    return this.handleOther(n);
  }

  /**
   * Encrypted push: try to decrypt by the JWE `kid` (the platform key, or an OWN tenant
   * key when available — see `EncryptionService.decryptPush`). On success we process the
   * plain event like any other. If we can't decrypt (FLE off, no key for the kid, or a
   * decryption failure) we PERSIST the raw envelope BEFORE acking — otherwise MC won't
   * retry after 200 and the event is lost; these rows are reprocessed once the key exists.
   */
  private async handleEncrypted(event: McWebhookEventDto): Promise<Ack> {
    const r = (event ?? {}) as unknown as Record<string, any>;
    const decrypted = this.encryption.decryptPush(r);
    if (decrypted !== undefined) {
      const n = this.normalize(decrypted as McWebhookEventDto);
      this.logger.log('Encrypted push decrypted — processing.');
      return n.eventType && STATUS_EVENT_TYPES.has(n.eventType)
        ? this.handleStatus(n)
        : this.handleOther(n);
    }
    return this.persistEncrypted(r);
  }

  /**
   * Persist the raw encrypted envelope to `tx_status` (`eventType='ENCRYPTED'`) BEFORE the
   * ack — if the write fails we do NOT swallow it: the exception → 500 → MC retries
   * (persist-before-ack). Dedup key: a top-level ref if MC sends one OUTSIDE the cipher,
   * else the ciphertext hash (`enc:sha256`) — a retry of the identical envelope dedups; if
   * MC re-encrypts per retry the hash changes → a possible duplicate, reconciled later.
   * tenantId=null: attribution is impossible (partnerId is under the cipher); such rows are
   * filtered out of the merchant status read (findForTenant → status types only).
   */
  private async persistEncrypted(r: Record<string, any>): Promise<Ack> {
    const cipher = String(r.encrypted_payload?.data ?? '');
    const ref =
      firstRef(r.eventRef, r.event_ref, r.notificationId, r.notification_id) ??
      (cipher ? `enc:${sha256hex(cipher)}` : null);

    const fresh = await this.statusStore.record({
      eventRef: ref,
      tenantId: null,
      transactionReference: null,
      eventType: 'ENCRYPTED',
      transactionType: null,
      status: null,
      stage: null,
      payload: r,
    });

    this.logger.warn(
      fresh
        ? 'Encrypted push stored (no decryption key for its kid) — acked without processing.'
        : 'Encrypted push — duplicate (already stored), acked without processing.',
    );
    return { status: fresh ? 'accepted' : 'duplicate' };
  }

  /** Status event → atomic persist with dedup by eventRef. */
  private async handleStatus(n: NormalizedEvent): Promise<Ack> {
    // Tenant attribution: OWN → by partnerId; PLATFORM/unknown → shared pool (null).
    const tenantId = n.partnerId
      ? await this.tenants.findOwnTenantIdByPartnerId(n.partnerId)
      : null;

    const fresh = await this.statusStore.record({
      eventRef: n.ref,
      tenantId,
      transactionReference: n.transactionReference,
      eventType: n.eventType,
      transactionType: n.transactionType,
      status: n.status,
      stage: n.stage,
      payload: n.raw,
    });

    if (!fresh) {
      this.logger.log(
        `Duplicate status webhook eventRef=${clipForLog(n.ref)} — ignoring`,
      );
      return { status: 'duplicate' };
    }
    this.logger.log(
      `Status stored: tx=${clipForLog(n.transactionReference)} type=${clipForLog(n.transactionType)} status=${clipForLog(n.status)}${n.stage ? `/${clipForLog(n.stage)}` : ''}`,
    );
    return { status: 'accepted' };
  }

  /**
   * Non-status events: atomic dedup+audit in Postgres (the same `tx_status`, INSERT ON
   * CONFLICT by eventRef) + log. Without a ref dedup is impossible (NULLs are distinct in
   * Postgres) → we don't persist (else we'd breed rows), just accept. tenantId=null: these
   * events aren't attributed to a tenant (shared pool); they're filtered out of the merchant
   * status poll (findForTenant → status types only).
   */
  private async handleOther(n: NormalizedEvent): Promise<Ack> {
    if (!n.ref) {
      this.logger.log(`Webhook eventType=${clipForLog(n.eventType)} (no ref)`);
      return { status: 'accepted' };
    }
    const fresh = await this.statusStore.record({
      eventRef: n.ref,
      tenantId: null,
      transactionReference: n.transactionReference,
      eventType: n.eventType,
      transactionType: n.transactionType,
      status: n.status,
      stage: n.stage,
      payload: n.raw,
    });
    if (!fresh) {
      this.logger.log(
        `Duplicate webhook eventRef=${clipForLog(n.ref)} — ignoring`,
      );
      return { status: 'duplicate' };
    }
    this.logger.log(`Webhook eventType=${clipForLog(n.eventType)}`);
    return { status: 'accepted' };
  }

  /** Detects an encrypted MC body: `{ encrypted_payload: { data } }`. */
  private isEncrypted(event: McWebhookEventDto): boolean {
    const env = event as unknown as {
      encrypted_payload?: { data?: unknown };
    };
    return env?.encrypted_payload?.data != null;
  }

  /**
   * Reduces camelCase and snake_case to a single shape and pulls status/stage from the
   * usual places (quote.confirmStatus / cancelStatus or the top level). Fields beyond those
   * declared in the DTO live on the object (passthrough, whitelist:false).
   */
  private normalize(event: McWebhookEventDto): NormalizedEvent {
    // `event ?? {}` — the body may arrive empty/null (POST with no body) → without this,
    // accessing properties would crash the handler with a 500 (and the contract is always
    // 200).
    const r = (event ?? {}) as unknown as Record<string, any>;
    const quote = (r.quote ?? {}) as Record<string, any>;
    const confirm = (quote.confirmStatus ?? quote.cancelStatus ?? {}) as Record<
      string,
      any
    >;
    return {
      ref:
        firstRef(
          r.eventRef,
          r.event_ref,
          r.notificationId,
          r.notification_id,
        ) ?? null,
      eventType: r.eventType ?? r.event_type ?? null,
      partnerId: r.partnerId ?? r.partner_id ?? null,
      transactionReference:
        r.transactionReference ?? r.transaction_reference ?? null,
      transactionType: r.transactionType ?? r.transaction_type ?? null,
      status: confirm.status ?? r.status ?? null,
      stage: confirm.pendingStage ?? r.stage ?? null,
      raw: r,
    };
  }
}
