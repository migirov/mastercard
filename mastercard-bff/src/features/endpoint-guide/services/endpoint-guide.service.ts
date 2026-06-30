import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import { EndpointGuideQueryDto } from '../dto/endpoint-guide-query.dto';

export interface EndpointGuideResponse {
  corridor: {
    payment_type: string;
    destination_country: string;
    destination_currency: string;
    destination_payment_instrument: string;
  };
  fields: { name: string; required: boolean; description: string }[];
  limits: { min: string; max: string; currency: string };
  source: Source;
}

@Injectable()
export class EndpointGuideService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Field requirements for a remittance corridor. `live` → GET the gateway's endpoint-guide
   * specifications and best-effort map the opaque Mastercard JSON into the response shape;
   * the MC sandbox returns 502 for the generic partner-id, so live almost never succeeds and
   * we gracefully fall back to the synthesized corridor spec (the real deliverable).
   */
  async guide(q: EndpointGuideQueryDto): Promise<EndpointGuideResponse> {
    return liveOrDemo(
      this.cfg.featureMode('endpointGuide') === 'live',
      () => this.tryLive(q),
      () => this.synthesize(q),
    );
  }

  private async tryLive(
    q: EndpointGuideQueryDto,
  ): Promise<EndpointGuideResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: '/crossborder/endpoint-guide/specifications',
      query: {
        payment_type: q.payment_type,
        destination_country: q.destination_country,
        destination_currency: q.destination_currency,
        destination_payment_instrument: q.destination_payment_instrument,
      },
    });
    // Sandbox returns 502 for the generic partner-id → res.ok is false → fall back.
    if (!res.ok) return undefined;
    return mapLive(res.data, q);
  }

  private synthesize(q: EndpointGuideQueryDto): EndpointGuideResponse {
    const corridor = corridorOf(q);
    return {
      corridor,
      fields: [
        {
          name: 'recipient_account_uri',
          required: true,
          description: 'Beneficiary bank account (IBAN/BAN).',
        },
        {
          name: 'recipient_name',
          required: true,
          description: 'Legal name of the beneficiary.',
        },
        {
          name: 'purpose_of_payment',
          required: true,
          description: 'ISO purpose code for the corridor.',
        },
        {
          name: 'sender_address',
          required: false,
          description: 'Required above threshold for AML.',
        },
      ],
      limits: {
        min: '1.00',
        max: '50000.00',
        currency: corridor.destination_currency,
      },
      source: 'demo',
    };
  }
}

/** Coerce an opaque MC "required" flag (may be a boolean, `"true"`, `"Y"`, or `1`) to boolean. */
function asBoolish(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string')
    return ['true', 'y', 'yes', '1'].includes(v.trim().toLowerCase());
  return false;
}

/** Apply the corridor defaults (B2B / PHL / PHP / BANK) for any omitted query field. */
function corridorOf(
  q: EndpointGuideQueryDto,
): EndpointGuideResponse['corridor'] {
  return {
    payment_type: q.payment_type ?? 'B2B',
    destination_country: q.destination_country ?? 'PHL',
    destination_currency: q.destination_currency ?? 'PHP',
    destination_payment_instrument: q.destination_payment_instrument ?? 'BANK',
  };
}

/**
 * Best-effort map the opaque endpoint-guide JSON into the response shape. Only commits to a
 * live result when the payload actually carries a recognizable `fields` list; otherwise
 * returns undefined so the caller falls back to demo synthesis.
 */
function mapLive(
  data: unknown,
  q: EndpointGuideQueryDto,
): EndpointGuideResponse | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const rawFields = pick(data, 'fields');
  if (!Array.isArray(rawFields) || rawFields.length === 0) return undefined;

  const fields = rawFields
    .map((f) => {
      const name = asString(pick(f, 'name'));
      if (!name) return undefined;
      return {
        name,
        required: asBoolish(pick(f, 'required')),
        description: asString(pick(f, 'description')) ?? '',
      };
    })
    .filter(
      (f): f is { name: string; required: boolean; description: string } =>
        f !== undefined,
    );
  if (fields.length === 0) return undefined;

  const corridor = corridorOf(q);
  return {
    corridor,
    fields,
    limits: {
      min: asString(pick(data, 'limits', 'min')) ?? '1.00',
      max: asString(pick(data, 'limits', 'max')) ?? '50000.00',
      currency:
        asString(pick(data, 'limits', 'currency')) ??
        corridor.destination_currency,
    },
    source: 'live',
  };
}
