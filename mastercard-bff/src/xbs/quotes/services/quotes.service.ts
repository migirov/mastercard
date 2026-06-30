import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { DEMO_SPREAD_PCT, midRate } from '../../common/fx-rates';
import { liveOrDemo } from '../../common/live-or-demo';
import { asNumber, firstDefined, pick, round4 } from '../../common/parse.util';
import { QuoteRequestDto } from '../dto/quote-request.dto';

export interface QuoteResponse {
  fx_rate: number;
  mid_rate: number;
  spread_pct: number;
  source_amount: number;
  target_amount: number;
  source: Source;
}

// 4-dp rounding for display (shared helper).
const round = round4;

@Injectable()
export class QuotesService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * `live` → ask the gateway for a rate/quote and defensively extract an fx rate from
   * the opaque MC JSON; on ANY failure fall back to demo synthesis (source flips to
   * 'demo'). `demo` → synthesize from the built-in mid-market table + a 0.5% spread.
   */
  async quote(req: QuoteRequestDto): Promise<QuoteResponse> {
    return liveOrDemo(
      this.cfg.mode('quote') === 'live',
      () => this.tryLive(req),
      () => this.synthesize(req, 'demo'),
    );
  }

  /** Best-effort live quote; undefined on any miss → caller falls back to demo. */
  private async tryLive(
    req: QuoteRequestDto,
  ): Promise<QuoteResponse | undefined> {
    // Full MC quoterequest in the sandbox-accepted shape (per the gateway's live e2e). The
    // sender/recipient URIs + origination/type are the documented sandbox values; the currency
    // pair + amount come from the caller. transaction_reference must be a non-empty alnum ref.
    const ref = `XBSDEMO${Date.now()}`;
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/quotes',
      body: {
        quoterequest: {
          transaction_reference: ref,
          sender_account_uri: 'tel:+25406005',
          recipient_account_uri: 'tel:+254069832',
          payment_amount: {
            amount: String(req.amount),
            currency: req.source_currency.toUpperCase(),
          },
          payment_origination_country: 'USA',
          payment_type: 'P2P',
          quote_type: {
            forward: { receiver_currency: req.target_currency.toUpperCase() },
          },
        },
      },
    });
    if (!res.ok) return undefined;

    // MC quote response shape (sandbox-confirmed):
    //   { quote: { proposals: { proposal: [ { quote_fx_rate, credited_amount:{amount}, ... } ] } } }
    // Navigate to the first proposal (the `proposal` level is nested inside `proposals`), then
    // read the fx rate + credited amount. Parse defensively across snake/camel variants.
    const proposalsRaw =
      (pick(res.data, 'quote', 'proposals', 'proposal') as unknown) ??
      (pick(res.data, 'proposals', 'proposal') as unknown) ??
      (pick(res.data, 'quote', 'proposals') as unknown) ??
      (pick(res.data, 'proposals') as unknown);
    const proposal = Array.isArray(proposalsRaw)
      ? proposalsRaw[0]
      : proposalsRaw;

    const rate = asNumber(
      firstDefined(proposal ?? res.data, [
        ['quote_fx_rate'],
        ['quoteFxRate'],
        ['fxRate'],
        ['fx_rate'],
        ['exchange_rate'],
        ['rate'],
      ]),
    );
    if (rate === undefined || rate <= 0) return undefined;

    const credited = asNumber(
      firstDefined(proposal ?? {}, [
        ['credited_amount', 'amount'],
        ['creditedAmount', 'amount'],
      ]),
    );

    // We got a real rate from MC → 'live'. We only have the customer rate (no separate
    // mid/spread from MC), so don't fabricate one: report mid = the live rate, spread 0.
    return {
      fx_rate: round(rate),
      mid_rate: round(rate),
      spread_pct: 0,
      source_amount: req.amount,
      // Derive from the SAME rounded rate we display, so source_amount × fx_rate ≈ target_amount.
      target_amount:
        credited !== undefined
          ? round(credited)
          : round(req.amount * round(rate)),
      source: 'live',
    };
  }

  /** Synthesize a believable quote: mid-market rate from the table minus a 0.5% spread. */
  private synthesize(req: QuoteRequestDto, source: Source): QuoteResponse {
    const mid = midRate(req.source_currency, req.target_currency);
    // Customer-facing rate is slightly worse than mid (spread on the sell side).
    const fx = mid * (1 - DEMO_SPREAD_PCT / 100);
    return {
      fx_rate: round(fx),
      mid_rate: round(mid),
      spread_pct: DEMO_SPREAD_PCT,
      source_amount: req.amount,
      target_amount: round(req.amount * fx),
      source,
    };
  }
}
