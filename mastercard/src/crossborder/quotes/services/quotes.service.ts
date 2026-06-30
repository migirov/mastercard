import { Injectable } from '@nestjs/common';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { ConfirmationRequestDto } from '../dto/confirmation-request.dto';
import { QuoteRequestDto } from '../dto/quote-request.dto';

/** Cross-Border quotes: request, confirm, cancel and retrieve a confirmed quote. */
@Injectable()
export class QuotesService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /**
   * Request a quote (POST). Body encryption (MTF/Prod) and signing happen
   * transparently in the `MastercardClient` axios interceptor; here we return a
   * plain object.
   */
  createQuote(tenantId: string, body: QuoteRequestDto) {
    return this.gw.run(tenantId, 'createQuote', (c) => ({
      method: 'POST',
      path: mcPath.quotes(this.gw.partner(c)),
      body,
    }));
  }

  /** Confirm a quote (POST). Encryption happens in the interceptor. */
  confirmQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.gw.run(tenantId, 'confirmQuote', (c) => ({
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
  cancelConfirmedQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.gw.run(tenantId, 'cancelConfirmedQuote', (c) => ({
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
  retrieveConfirmedQuote(tenantId: string, ref: string, proposalId: string) {
    return this.gw.run(tenantId, 'retrieveConfirmedQuote', (c) => ({
      method: 'GET',
      path: mcPath.retrieveConfirmedQuote(this.gw.partner(c), ref, proposalId),
    }));
  }
}
