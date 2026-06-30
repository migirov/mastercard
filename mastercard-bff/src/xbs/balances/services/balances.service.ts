import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { liveOrDemo } from '../../common/live-or-demo';
import { asNumber, asString, pick } from '../../common/parse.util';

export interface Balance {
  currency: string;
  available: number;
}

export interface BalancesResponse {
  balances: Balance[];
  source: Source;
}

/** Fixed demo balances (plausible numbers for the Fintory demo company). */
const DEMO_BALANCES: Balance[] = [
  { currency: 'ILS', available: 250000 },
  { currency: 'USD', available: 80000 },
  { currency: 'EUR', available: 60000 },
];

@Injectable()
export class BalancesService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * `live` → GET balances from the gateway and defensively map the opaque MC JSON to
   * `{ currency, available }[]`; fall back to demo on any error. `demo` → the fixed list.
   */
  async balances(): Promise<BalancesResponse> {
    return liveOrDemo(
      this.cfg.mode('balances') === 'live',
      () => this.tryLive(),
      () => ({ balances: DEMO_BALANCES, source: 'demo' }),
    );
  }

  /** Live balances from the gateway; undefined on miss → caller falls back to demo. */
  private async tryLive(): Promise<BalancesResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: '/crossborder/balances',
    });
    if (!res.ok) return undefined;
    const mapped = this.mapLive(res.data);
    return mapped.length > 0 ? { balances: mapped, source: 'live' } : undefined;
  }

  /**
   * Pull a `{currency, available}[]` from the gateway's balances response. Mastercard returns
   * an array of accounts shaped like:
   *   [{ settlementCurrency: 'USD', balanceDetails: { availableBalance: { amount: '8000.50',
   *      currency: 'USD' }, ... } }, ...]
   * We read settlementCurrency + balanceDetails.availableBalance.amount, with fallbacks for
   * other shapes.
   */
  private mapLive(data: unknown): Balance[] {
    const candidates =
      (Array.isArray(data) ? data : undefined) ??
      (pick(data, 'accounts') as unknown) ??
      (pick(data, 'balances') as unknown) ??
      (pick(data, 'account_balances') as unknown);
    if (!Array.isArray(candidates)) return [];
    const out: Balance[] = [];
    for (const item of candidates) {
      const currency = asString(
        pick(item, 'settlementCurrency') ??
          pick(item, 'balanceDetails', 'availableBalance', 'currency') ??
          pick(item, 'currency') ??
          pick(item, 'currency_code'),
      );
      const available = asNumber(
        pick(item, 'balanceDetails', 'availableBalance', 'amount') ??
          pick(item, 'availableBalance', 'amount') ??
          pick(item, 'available') ??
          pick(item, 'balance'),
      );
      if (currency && available !== undefined) {
        out.push({ currency: currency.toUpperCase(), available });
      }
    }
    return out;
  }
}
