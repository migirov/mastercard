import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import { BankLookupDto } from '../dto/bank-lookup.dto';

export interface BankResult {
  name?: string;
  bic?: string;
  branch?: string;
  country?: string;
  address?: string;
}

export interface BankLookupResponse {
  banks: BankResult[];
  total: number;
  source: Source;
}

@Injectable()
export class BankLookupService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Bank Information Lookup (MC Account-Validation family). `live` → POST to the gateway's
   * bank-lookups and flatten the opaque `bankInfo.banks.bankData` list; fall back to demo on
   * any miss. `demo` → a couple of synthesized banks for the searched name/country.
   */
  async lookup(req: BankLookupDto): Promise<BankLookupResponse> {
    return liveOrDemo(
      this.cfg.featureMode('bankLookup') === 'live',
      () => this.tryLive(req),
      () => this.synthesize(req),
    );
  }

  /** MC bank-lookups (FLE), per the gateway's live e2e:
   *  `{ bank: { name, country, bic: { type, value } } }` → `{ bankInfo: { banks: { bankData: [...] } } }`. */
  private async tryLive(
    req: BankLookupDto,
  ): Promise<BankLookupResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/bank-lookups',
      body: {
        bank: {
          name: req.name,
          country: (req.country || 'GBR').toUpperCase(),
          bic: { type: null, value: req.bic ?? null },
        },
      },
    });
    if (!res.ok) return undefined;
    const arr = pick(res.data, 'bankInfo', 'banks', 'bankData');
    if (!Array.isArray(arr)) return undefined;
    const banks = arr.map((b) => mapBank(b));
    return { banks, total: banks.length, source: 'live' };
  }

  private synthesize(req: BankLookupDto): BankLookupResponse {
    const c = (req.country || 'GBR').toUpperCase();
    const cleanName = req.name.replace(/\*/g, '').trim() || 'Demo Bank';
    const banks: BankResult[] = [
      {
        name: `${cleanName} PLC`,
        bic: req.bic || `DEMO${c.slice(0, 2)}PP`,
        branch: 'Main Branch',
        country: c,
        address: `1 High Street, ${c}`,
      },
      {
        name: `${cleanName} Savings & Trust`,
        bic: `DMST${c.slice(0, 2)}2L`,
        branch: 'City Branch',
        country: c,
        address: `22 King Road, ${c}`,
      },
    ];
    return { banks, total: banks.length, source: 'demo' };
  }
}

/** Map one opaque MC bank record to our flat shape (defensive across field variants). */
function mapBank(b: unknown): BankResult {
  const bics = pick(b, 'bics');
  const bic = Array.isArray(bics)
    ? asString(pick(bics[0], 'value'))
    : // a single BIC may be nested ({bic:{value}}) or flat ({bic:"..."}) — try both
      (asString(pick(b, 'bic', 'value')) ?? asString(pick(b, 'bic')));
  const addr = pick(b, 'address');
  const address =
    [
      asString(pick(addr, 'line1')) ?? asString(pick(addr, 'addressLine1')),
      asString(pick(addr, 'city')),
      asString(pick(addr, 'country')),
    ]
      .filter(Boolean)
      .join(', ') || undefined;
  return {
    name: asString(pick(b, 'name')),
    bic,
    branch: asString(pick(b, 'branchName')),
    country: asString(pick(addr, 'country')),
    address,
  };
}
