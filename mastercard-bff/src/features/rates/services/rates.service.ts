import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asNumber, round4 } from '../../../xbs/common/parse.util';
import { midRate } from '../../../xbs/common/fx-rates';
import { RatesQueryDto } from '../dto/rates-query.dto';

/** One row of the FX board: a currency pair and its current mid-market rate. */
export interface RateRow {
  pair: string;
  rate: number;
  change?: number;
}

export interface RatesResponse {
  base?: string;
  rates: RateRow[];
  asOf: string;
  source: Source;
}

/** The synthesized board's pairs — the well-known cross-border corridors. */
const DEMO_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['USD', 'ILS'],
  ['EUR', 'ILS'],
  ['GBP', 'ILS'],
  ['USD', 'EUR'],
  ['EUR', 'USD'],
];

@Injectable()
export class RatesService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * FX / Carded Rates board. `live` → GET the gateway's `/crossborder/rates` and map a
   * NON-EMPTY rate map; the MC sandbox returns `{"rates":{}}` (empty), so on any miss we
   * gracefully fall back to demo. `demo` → a believable, deterministic synthesized board.
   */
  async board(q: RatesQueryDto): Promise<RatesResponse> {
    return liveOrDemo(
      this.cfg.featureMode('rates') === 'live',
      () => this.tryLive(q),
      () => this.synthesize(q),
    );
  }

  /** MC carded rates: `{ rates: { "USD/ILS": 3.7, ... } }` → our flat board. An empty
   *  map (the sandbox default) yields no pairs → `undefined` so we fall back to demo. */
  private async tryLive(q: RatesQueryDto): Promise<RatesResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: '/crossborder/rates',
    });
    if (!res.ok) return undefined;
    const map = (res.data as Record<string, unknown> | null)?.rates;
    if (map === null || typeof map !== 'object') return undefined;
    const rates: RateRow[] = [];
    for (const [pair, value] of Object.entries(
      map as Record<string, unknown>,
    )) {
      const rate = asNumber(value);
      if (rate !== undefined) rates.push({ pair, rate });
    }
    if (rates.length === 0) return undefined;

    // Honor the same base/quote narrowing the demo path applies, so the endpoint returns the
    // same SHAPE in both modes. If MC's board lacks the requested pair, fall back to demo
    // (which can synthesize it) rather than returning the whole board with a misleading echo.
    const base = q.base?.toUpperCase();
    const quote = q.quote?.toUpperCase();
    if (base && quote) {
      const want = `${base}/${quote}`;
      const one = rates.filter((r) => r.pair.toUpperCase() === want);
      if (one.length === 0) return undefined;
      return {
        base,
        rates: one,
        asOf: new Date().toISOString(),
        source: 'live',
      };
    }
    return {
      base,
      rates,
      asOf: new Date().toISOString(),
      source: 'live',
    };
  }

  /** Build a plausible, deterministic board from the built-in mid-rate table. When both
   *  `base` and `quote` are given, return just that one pair. */
  private synthesize(q: RatesQueryDto): RatesResponse {
    const base = q.base?.toUpperCase();
    const quote = q.quote?.toUpperCase();
    const pairs: ReadonlyArray<readonly [string, string]> =
      base && quote ? [[base, quote]] : DEMO_PAIRS;
    const rates: RateRow[] = pairs.map(([s, t]) => {
      const pair = `${s}/${t}`;
      return {
        pair,
        rate: round4(midRate(s, t)),
        change: dailyChange(pair),
      };
    });
    return {
      base,
      rates,
      asOf: new Date().toISOString(),
      source: 'demo',
    };
  }
}

/**
 * A small, DETERMINISTIC daily change derived from the pair string (no `Math.random`,
 * which is banned — the demo must be reproducible). Yields a value in `[-0.03, 0.03]`.
 */
function dailyChange(pair: string): number {
  let sum = 0;
  for (const ch of pair) sum += ch.charCodeAt(0);
  return ((sum % 7) - 3) / 100;
}
