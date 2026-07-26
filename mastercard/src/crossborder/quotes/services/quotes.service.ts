import { Injectable } from '@nestjs/common';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { TransactionOwnership } from '../../common/ownership/transaction-ownership.service';
import { ConfirmationRequestDto } from '../dto/confirmation-request.dto';
import { QuoteRequestDto } from '../dto/quote-request.dto';

/**
 * Cross-Border quotes: request, confirm, cancel and retrieve a confirmed quote.
 *
 * `createQuote` is the CLAIM point for a `transaction_reference`, and the follow-up
 * operations are gated on that claim. It has to work this way round: confirmations happen
 * before any payment exists, so gating them on a `payment_idempotency` record would reject
 * every legitimate confirmation in the system.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly gw: CrossBorderGateway,
    private readonly ownership: TransactionOwnership,
  ) {}

  /**
   * Request a quote (POST). Body encryption (MTF/Prod) and signing happen
   * transparently in the `MastercardClient` axios interceptor; here we return a
   * plain object.
   */
  async createQuote(tenantId: string, body: QuoteRequestDto) {
    const tenant = await this.gw.activeTenant(tenantId);
    const result = await this.gw.runFor(tenant, 'createQuote', (c) => ({
      method: 'POST',
      path: mcPath.quotes(this.gw.partner(c)),
      body,
    }));
    // Claim only after MC accepted the quote, so a rejected request does not lock the
    // reference. Best-effort: a claim-write failure must not fail a successful quote.
    await this.ownership.claim(
      tenant,
      body?.quoterequest?.transaction_reference,
    );
    return result;
  }

  /** Confirm a quote (POST). Encryption happens in the interceptor. */
  async confirmQuote(tenantId: string, body: ConfirmationRequestDto) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsRef(tenant, body?.transactionReference);
    return this.gw.runFor(tenant, 'confirmQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteConfirmations(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Cancel a CONFIRMED quote (POST). The body is identical to confirmation
   * (`{ transactionReference, proposalId }`) → we reuse ConfirmationRequestDto.
   * Before a payment is initiated → reserved funds are released; afterwards MC
   * rejects it. Body encryption (MTF/Prod) happens in the interceptor.
   */
  async cancelConfirmedQuote(tenantId: string, body: ConfirmationRequestDto) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsRef(tenant, body?.transactionReference);
    return this.gw.runFor(tenant, 'cancelConfirmedQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteCancellations(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Retrieve a confirmed quote (GET). ref/proposalId are already validated by
   * SafeIdPipe in the controller. There is no request body/encryption; the
   * response is decrypted by the interceptor in MTF/Prod.
   */
  async retrieveConfirmedQuote(
    tenantId: string,
    ref: string,
    proposalId: string,
  ) {
    const tenant = await this.gw.activeTenant(tenantId);
    await this.ownership.assertOwnsRef(tenant, ref);
    return this.gw.runFor(tenant, 'retrieveConfirmedQuote', (c) => ({
      method: 'GET',
      path: mcPath.retrieveConfirmedQuote(this.gw.partner(c), ref, proposalId),
    }));
  }
}
