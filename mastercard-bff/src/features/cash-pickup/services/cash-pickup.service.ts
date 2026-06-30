import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { CashPickupQueryDto } from '../dto/cash-pickup-query.dto';

export type CashPickupKind = 'countries' | 'cities' | 'providers' | 'branches';

export interface CashPickupResponse {
  items: Record<string, unknown>[];
  total?: number;
  source: Source;
}

@Injectable()
export class CashPickupService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Cash-pickup catalogs (countries / cities / providers / branches). `live` → GET the
   * gateway's `cash-pickup/<kind>` and flatten the opaque `items` list (MC wraps `countries`
   * in an array, the rest in `{count,items}` — handled below); fall back to demo on any miss.
   */
  async list(
    kind: CashPickupKind,
    q: CashPickupQueryDto,
  ): Promise<CashPickupResponse> {
    return liveOrDemo(
      this.cfg.featureMode('cashPickup') === 'live',
      () => this.tryLive(kind, q),
      () => this.synthesize(kind, q),
    );
  }

  private async tryLive(
    kind: CashPickupKind,
    q: CashPickupQueryDto,
  ): Promise<CashPickupResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: `/crossborder/cash-pickup/${kind}`,
      query: {
        cash_pickup_type: q.cash_pickup_type,
        country: q.country,
        currency: q.currency,
        provider_id: q.provider_id,
        state: q.state,
        city: q.city,
        offset: q.offset,
        limit: q.limit,
      },
    });
    if (!res.ok) return undefined;
    const items = extractItems(res.data);
    if (!items) return undefined;
    const total = totalOf(res.data);
    return { items, total, source: 'live' };
  }

  private synthesize(
    kind: CashPickupKind,
    q: CashPickupQueryDto,
  ): CashPickupResponse {
    const c = (q.country ?? 'GTM').toUpperCase();
    const cur = (q.currency ?? 'GTQ').toUpperCase();
    const items: Record<string, unknown>[] = {
      countries: [
        { countryAlpha3: 'NGA', currency: 'NGN', cashPickupType: 'PANY' },
        { countryAlpha3: 'GTM', currency: 'GTQ', cashPickupType: 'PANY' },
        { countryAlpha3: 'PHL', currency: 'PHP', cashPickupType: 'PANY' },
      ],
      cities: [
        {
          country: c,
          currency: cur,
          city: 'GUATEMALA CITY',
          stateName: 'GUATEMALA',
        },
        {
          country: c,
          currency: cur,
          city: 'ANTIGUA',
          stateName: 'SACATEPEQUEZ',
        },
        {
          country: c,
          currency: cur,
          city: 'QUETZALTENANGO',
          stateName: 'QUETZALTENANGO',
        },
      ],
      providers: [
        {
          providerId: 'demo-0001',
          providerName: 'ORIENT EXCHANGE',
          country: c,
          currency: cur,
        },
        {
          providerId: 'demo-0002',
          providerName: 'GLOBAL REMIT',
          country: c,
          currency: cur,
        },
      ],
      branches: [
        {
          name: 'Central Branch',
          city: q.city ?? 'GUATEMALA CITY',
          address: '1 Avenida 10-00',
        },
        {
          name: 'Airport Branch',
          city: q.city ?? 'GUATEMALA CITY',
          address: 'Terminal 2, La Aurora',
        },
      ],
    }[kind];
    return { items, total: items.length, source: 'demo' };
  }
}

/** Pull the `items` array out of MC's shape: `[{items:[...]}]` (countries) or `{items:[...]}`. */
function extractItems(data: unknown): Record<string, unknown>[] | undefined {
  if (Array.isArray(data)) {
    const first = data[0];
    const inner =
      first && typeof first === 'object'
        ? (first as Record<string, unknown>).items
        : undefined;
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    return data as Record<string, unknown>[];
  }
  if (data && typeof data === 'object') {
    const inner = (data as Record<string, unknown>).items;
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  }
  return undefined;
}

function totalOf(data: unknown): number | undefined {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const t = (data as Record<string, unknown>).total;
    const n = typeof t === 'string' ? Number(t) : t;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}
