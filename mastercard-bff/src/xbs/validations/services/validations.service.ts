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
  /**
   * `true` only when something actually confirmed the address. Always `false` when
   * `checked` is false — a consumer that reads nothing but this field must not be misled
   * into treating "we could not check" as "this is fine".
   */
  valid: boolean;
  /**
   * Whether an address check ran at all. An address, unlike an IBAN, has no offline test:
   * there is no checksum, and "the string is not empty" proves nothing. So when the live
   * service is unavailable the honest answer is `checked: false`, not a verdict.
   */
  checked: boolean;
  /**
   * The country the check ran against. Reported because it is not always the one the caller
   * had in mind: an omitted country falls back to `DEFAULT_ADDRESS_COUNTRY`, and validating a
   * Tel Aviv address against US address rules returns "invalid" for a reason nobody can see
   * from the verdict alone.
   */
  country: string;
  source: Source;
}

/**
 * Used when the caller sends no country. Mastercard requires one, so something must be
 * chosen — but the choice is now reported back in the response instead of being applied
 * silently. Callers should send the real country; the SPA derives it from the IBAN prefix.
 */
export const DEFAULT_ADDRESS_COUNTRY = 'USA';

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

  /**
   * Address validation. `live` → POST to the gateway; `demo` (or any live failure) → a
   * NON-verdict, because there is nothing an offline check could honestly assert.
   *
   * The demo branch used to return `valid: req.address.trim().length > 0`, i.e. every
   * non-empty string was a valid beneficiary address. That is the same fail-open the IBAN
   * path had before it gained a checksum — except an address has no checksum to add, so the
   * fix is to stop answering rather than to answer better.
   *
   * Worth knowing when reading a `demo` result on the Mastercard sandbox: the sandbox accepts
   * `country: USA` only (anything else is a 400 on the `country` field), and within USA it
   * verifies exactly one documented test address. So a real non-US address legitimately ends
   * up here — unchecked, not invalid.
   */
  async validateAddress(
    req: ValidateAddressDto,
  ): Promise<AddressValidationResponse> {
    const country = (req.country || DEFAULT_ADDRESS_COUNTRY).toUpperCase();
    return liveOrDemo(
      this.cfg.mode('validation') === 'live',
      () => this.tryLiveAddress(req.address, country),
      () => ({ valid: false, checked: false, country, source: 'demo' }),
    );
  }

  /** MC address-validation (FLE), per the gateway's live e2e:
   *  `{ country, address }` → `{ status: 'VALID', verification: 'VERIFIED' }`. */
  private async tryLiveAddress(
    address: string,
    country: string,
  ): Promise<AddressValidationResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/address-validations',
      body: { country, address },
    });
    if (!res.ok) return undefined;
    const v = firstDefined(res.data, [
      ['status'],
      ['verification'],
      ['addressValidationResponse', 'status'],
      ['addressValidationResponse', 'verification'],
      ['valid'],
    ]);
    return { valid: truthyValid(v), checked: true, country, source: 'live' };
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
