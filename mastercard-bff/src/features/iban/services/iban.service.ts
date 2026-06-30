import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import { IbanGenerateDto } from '../dto/iban-generate.dto';

export interface IbanBank {
  bic?: string;
  name?: string;
  branchCode?: string;
  address?: string;
}

export interface IbanResponse {
  iban?: string;
  ban?: string;
  bank?: IbanBank;
  source: Source;
}

@Injectable()
export class IbanService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * IBAN Generation (MC Account-Validation family). `live` → POST to the gateway's
   * iban-generations and read the generated IBAN/BAN + bank out of the opaque MC JSON;
   * fall back to demo on any miss. `demo` → a structurally-plausible synthesized IBAN.
   */
  async generate(req: IbanGenerateDto): Promise<IbanResponse> {
    return liveOrDemo(
      this.cfg.featureMode('ibanGen') === 'live',
      () => this.tryLive(req),
      () => this.synthesize(req),
    );
  }

  /** MC iban-generations (FLE), per the gateway's live e2e:
   *  `{ accountUri:{type:'ban',value}, country, branchCode, accountNo }` →
   *  `{ ibanDetails: { accounts:{account:[{type:'IBAN',value},{type:'BAN',value}]}, bank } }`. */
  private async tryLive(
    req: IbanGenerateDto,
  ): Promise<IbanResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/iban-generations',
      body: {
        accountUri: req.ban ? { type: 'ban', value: req.ban } : undefined,
        country: (req.country || 'FRA').toUpperCase(),
        branchCode: req.branchCode,
        accountNo: req.accountNo,
      },
    });
    if (!res.ok) return undefined;

    const accounts = pick(res.data, 'ibanDetails', 'accounts', 'account');
    const list = Array.isArray(accounts) ? accounts : [];
    const iban = asString(
      pick(
        list.find((a) => asString(pick(a, 'type'))?.toUpperCase() === 'IBAN'),
        'value',
      ),
    );
    if (!iban) return undefined;
    const ban = asString(
      pick(
        list.find((a) => asString(pick(a, 'type'))?.toUpperCase() === 'BAN'),
        'value',
      ),
    );
    const bk = pick(res.data, 'ibanDetails', 'bank');
    const addr = pick(bk, 'address');
    return {
      iban,
      ban: ban ?? req.ban,
      bank: {
        bic: asString(pick(bk, 'bic', 'value')),
        name: asString(pick(bk, 'name')),
        branchCode: asString(pick(bk, 'branchCode')),
        address:
          [asString(pick(addr, 'city')), asString(pick(addr, 'country'))]
            .filter(Boolean)
            .join(', ') || undefined,
      },
      source: 'live',
    };
  }

  /**
   * Demo IBAN: country prefix + fixed `14` check digits + the (zero-padded) domestic
   * number. Not a real, mod-97-valid IBAN — a believable shape for the demo only.
   */
  private synthesize(req: IbanGenerateDto): IbanResponse {
    const cc = (req.country || 'FR').slice(0, 2).toUpperCase();
    const body = (
      (req.branchCode ?? '') + (req.accountNo ?? req.ban ?? '00000000000000')
    )
      .replace(/[^0-9A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 23)
      .padEnd(23, '0');
    return {
      iban: `${cc}14${body}`,
      ban: req.ban,
      bank: {
        bic: `DEMO${cc}PP`,
        name: 'Demo National Bank',
        branchCode: req.branchCode,
        address: `${cc} branch`,
      },
      source: 'demo',
    };
  }
}
