import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { isValidIban, normalizeIban } from '../../common/iban.util';
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

@Injectable()
export class ValidationsService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Account (IBAN) validation. `live` → POST to the gateway's account-validations and read a
   * truthy "valid" out of the opaque MC JSON; fall back to demo on any error. `demo` →
   * structural check PLUS the ISO 13616 checksum on the normalized IBAN.
   *
   * The fallback is silent by design, so the response's `source` is the only thing telling a
   * caller which of the two answered. Any UI that renders this MUST surface that distinction:
   * a local checksum is not a Mastercard confirmation, and showing them identically is how an
   * operator ends up trusting a beneficiary nobody verified.
   */
  async validateAccount(
    req: ValidateAccountDto,
  ): Promise<AccountValidationResponse> {
    const normalized = normalizeIban(req.iban);
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

  /**
   * The demo answer. It now includes the ISO 13616 checksum, so `valid: true` here means
   * "structurally sound and self-consistent" rather than merely "looks vaguely IBAN-shaped".
   *
   * Note a deliberate consequence: `FR070331234567890123456` — Mastercard's own sandbox test
   * IBAN, seeded into the demo invoices — is checksum-INVALID by design (23 chars where FR
   * requires 27, mod-97 = 85). With validation in `live` mode the real Mastercard answer is
   * what shows, and nothing changes. If the gateway is unreachable, that invoice will now
   * read as not-valid. That is this fix working, not a regression — do not "correct" the
   * checksum here to make one seeded fixture look nicer.
   */
  private synthesizeAccount(
    normalized: string,
    source: Source,
  ): AccountValidationResponse {
    return { valid: isValidIban(normalized), normalized, source };
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
