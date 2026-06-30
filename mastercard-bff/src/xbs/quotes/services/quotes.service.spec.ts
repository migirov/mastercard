import { McConfig, XbsMode } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { QuoteRequestDto } from '../dto/quote-request.dto';
import { QuotesService } from './quotes.service';

const req = (): QuoteRequestDto =>
  ({
    source_currency: 'USD',
    target_currency: 'ILS',
    amount: 1000,
  }) as unknown as QuoteRequestDto;

function make(mode: XbsMode, call?: jest.Mock): QuotesService {
  const cfg = { mode: () => mode } as unknown as McConfig;
  const gw = { call: call ?? jest.fn() } as unknown as GatewayClient;
  return new QuotesService(cfg, gw);
}

describe('QuotesService', () => {
  it('demo: synthesizes a mid-market rate with the demo spread', async () => {
    const r = await make('demo').quote(req());
    expect(r.source).toBe('demo');
    expect(r.mid_rate).toBe(3.7);
    expect(r.spread_pct).toBe(0.5);
    expect(r.fx_rate).toBe(3.6815);
    expect(r.target_amount).toBe(3681.5);
  });

  it('live: extracts the real fx rate + credited amount and does NOT fabricate a mid/spread', async () => {
    const call = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        quote: {
          proposals: {
            proposal: [
              { quote_fx_rate: '3.5', credited_amount: { amount: '3500' } },
            ],
          },
        },
      },
    });
    const r = await make('live', call).quote(req());
    expect(r.source).toBe('live');
    expect(r.fx_rate).toBe(3.5);
    expect(r.mid_rate).toBe(3.5); // not inflated by a fabricated spread
    expect(r.spread_pct).toBe(0);
    expect(r.target_amount).toBe(3500); // from MC's credited_amount
  });

  it('live miss: falls back to a demo quote', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).quote(req());
    expect(r.source).toBe('demo');
    expect(r.fx_rate).toBe(3.6815);
  });
});
