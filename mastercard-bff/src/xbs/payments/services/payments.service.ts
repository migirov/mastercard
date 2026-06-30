import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { liveOrDemo } from '../../common/live-or-demo';
import { asString, firstDefined } from '../../common/parse.util';
import { PayRequestDto } from '../dto/pay-request.dto';

export interface PayResponse {
  payment_ref: string;
  status: 'submitted';
  source: Source;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Initiate a payment. `live` → POST a minimal best-effort body to the gateway and
   * extract a payment reference from the opaque MC JSON; fall back to demo on any
   * error (payment submit needs MTF/Prod and routinely fails on sandbox — expected).
   * `demo` → generate a uuid payment_ref, status 'submitted'.
   */
  async pay(req: PayRequestDto): Promise<PayResponse> {
    return liveOrDemo(
      this.cfg.mode('payment') === 'live',
      () => this.tryLive(req),
      () => this.demo(req),
    );
  }

  /** Demo synthesis (also the live fallback): the business key the client supplied IS the
   *  reference echoed back, so status polling lines up with what was paid. */
  private demo(req: PayRequestDto): PayResponse {
    return {
      payment_ref: req.transaction_reference || randomUUID(),
      status: 'submitted',
      source: 'demo',
    };
  }

  private async tryLive(req: PayRequestDto): Promise<PayResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/payments',
      // Minimal best-effort MC payment body (full validity is hard on sandbox).
      body: {
        paymentrequest: {
          transaction_reference: req.transaction_reference,
          recipient_account_uri: `iban:${req.beneficiary_account.replace(
            /\s+/g,
            '',
          )}`,
          payment_amount: {
            amount: String(req.payment_amount),
            currency: req.payment_currency.toUpperCase(),
          },
          payment_type: 'P2B',
        },
      },
    });
    if (!res.ok) return undefined;

    // Only claim `live` if MC echoed back the PAYMENT's transaction_reference — proof it
    // recorded the request. We deliberately do NOT accept a bare top-level `id` (a generic
    // correlation id that's present even on soft failures) — that would mislabel a
    // non-recorded payment as `live`. No real ref → undefined → caller falls back to demo.
    const ref = asString(
      firstDefined(res.data, [
        ['payment', 'transaction_reference'],
        ['paymentresponse', 'transaction_reference'],
        ['transaction_reference'],
      ]),
    );
    if (!ref) return undefined;
    return { payment_ref: ref, status: 'submitted', source: 'live' };
  }
}
