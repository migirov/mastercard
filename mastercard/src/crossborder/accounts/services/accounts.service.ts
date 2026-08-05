import { Injectable, NotImplementedException } from '@nestjs/common';
import { GatewayConfig } from '../../../config/gateway-config';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';

/** Cross-Border account info: balances and FX (Carded) rate pull. */
@Injectable()
export class AccountsService {
  constructor(
    private readonly gw: CrossBorderGateway,
    private readonly config: GatewayConfig,
  ) {}

  /**
   * List of accounts and balances (GET, no encryption).
   *
   * NOT AVAILABLE on the PSD2 edges. Mastercard routes the Balance API through the
   * OAuth2 *Authorization Code* flow there, while every other Cross-Border API uses
   * the request token this gateway implements — an interactive, user-consent flow
   * with no documented server-to-server variant. Rather than send a request that
   * can only fail, refuse locally with a 501 that names the reason.
   *
   * Balances are also only meaningful under the Prefunding or Collateral settlement
   * models (Mastercard's Product Guide); customers on Next Day Settlement have no
   * ledger balance to read at all.
   */
  getBalances(tenantId: string) {
    if (this.config.authMode === 'oauth2-request-token') {
      throw new NotImplementedException(
        'The Balance API is not available on the PSD2 endpoints: Mastercard ' +
          'requires the OAuth2 Authorization Code flow for balances, which this ' +
          'gateway does not implement (every other Cross-Border API uses the ' +
          'request token). Balances also apply only to the Prefunding and ' +
          'Collateral settlement models.',
      );
    }
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
