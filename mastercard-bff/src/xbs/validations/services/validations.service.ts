import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { liveOrDemo } from '../../common/live-or-demo';
import { firstDefined } from '../../common/parse.util';
import { ValidateAccountDto } from '../dto/validate-account.dto';
import { ValidateAddressDto } from '../dto/validate-address.dto';

export interface AccountValidationResponse {
  valid: boolean;
  normalized?: string;
  source: Source;
}

export interface AddressValidationResponse {
  valid: boolean;
  source: Source;
}

/** Basic IBAN sanity: 15–34 chars, 2-letter country + 2 check digits + alphanumerics. */
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

@Injectable()
export class ValidationsService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Account (IBAN) validation. `live` → POST to the gateway's account-validations and
   * read a truthy "valid" out of the opaque MC JSON; fall back to demo on any error.
   * `demo` → a basic length/charset sanity check on the normalized IBAN.
   */
  async validateAccount(
    req: ValidateAccountDto,
  ): Promise<AccountValidationResponse> {
    const normalized = req.iban.replace(/\s+/g, '').toUpperCase();
    return liveOrDemo(
      this.cfg.mode('validation') === 'live',
      () => this.tryLiveAccount(normalized),
      () => this.synthesizeAccount(normalized, 'demo'),
    );
  }

  /** MC account-validation (FLE), per the gateway's live e2e:
   *  `{ accountUri: { type: 'IBAN', value } }` → `{ status: 'SUCCESS', accountMatch }`. */
  private async tryLiveAccount(
    normalized: string,
  ): Promise<AccountValidationResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/account-validations',
      body: { accountUri: { type: 'IBAN', value: normalized } },
    });
    if (!res.ok) return undefined;
    const v = firstDefined(res.data, [
      ['status'],
      ['accountValidationResponse', 'status'],
      ['valid'],
      ['is_valid'],
    ]);
    return { valid: truthyValid(v), normalized, source: 'live' };
  }

  async validateAddress(
    req: ValidateAddressDto,
  ): Promise<AddressValidationResponse> {
    return liveOrDemo(
      this.cfg.mode('validation') === 'live',
      () => this.tryLiveAddress(req),
      () => ({ valid: req.address.trim().length > 0, source: 'demo' }),
    );
  }

  /** MC address-validation (FLE), per the gateway's live e2e:
   *  `{ country, address }` → `{ status: 'VALID', verification: 'VERIFIED' }`. */
  private async tryLiveAddress(
    req: ValidateAddressDto,
  ): Promise<AddressValidationResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/address-validations',
      body: {
        country: (req.country ?? 'USA').toUpperCase(),
        address: req.address,
      },
    });
    if (!res.ok) return undefined;
    const v = firstDefined(res.data, [
      ['status'],
      ['verification'],
      ['addressValidationResponse', 'status'],
      ['addressValidationResponse', 'verification'],
      ['valid'],
    ]);
    return { valid: truthyValid(v), source: 'live' };
  }

  private synthesizeAccount(
    normalized: string,
    source: Source,
  ): AccountValidationResponse {
    const valid = normalized.length > 0 && IBAN_RE.test(normalized);
    return { valid, normalized, source };
  }
}

/**
 * Interpret a "valid"-ish field from opaque MC JSON: booleans pass through; common
 * positive strings (VALID/VERIFIED/SUCCESS/true) count as valid.
 */
function truthyValid(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    return ['valid', 'verified', 'success', 'true', 'ok'].includes(
      v.toLowerCase(),
    );
  }
  return false;
}
