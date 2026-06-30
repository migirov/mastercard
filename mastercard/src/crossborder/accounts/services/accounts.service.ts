import { Injectable } from '@nestjs/common';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';

/** Cross-Border account info: balances and FX (Carded) rate pull. */
@Injectable()
export class AccountsService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /** List of accounts and balances (GET, no encryption). */
  getBalances(tenantId: string) {
    return this.gw.run(tenantId, 'getBalances', (c) => ({
      method: 'GET',
      path: mcPath.balances(this.gw.partner(c)),
    }));
  }

  /**
   * Carded / FX Rate Pull (GET, WITHOUT a body): FX rates for configured
   * corridors — the primary way to obtain rates before initiating a payment.
   * Per the MC docs this is the `getFxRates` operation: GET, "No Request body"
   * (hence NOT POST — the former POST variant was removed as non-existent at MC).
   * Sandbox is NOT available for Carded Rate (per the MC docs) → only the gateway
   * wiring is exercised. The push variant (Carded Rate Push) is a webhook on
   * /webhooks/mastercard/webhook.
   */
  getRates(tenantId: string) {
    return this.gw.run(tenantId, 'getRates', (c) => ({
      method: 'GET',
      path: mcPath.rates(this.gw.partner(c)),
    }));
  }
}
