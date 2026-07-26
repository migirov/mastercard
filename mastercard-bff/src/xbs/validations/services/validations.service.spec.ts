import { McConfig, XbsMode } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { ValidateAccountDto } from '../dto/validate-account.dto';
import { ValidateAddressDto } from '../dto/validate-address.dto';
import {
  DEFAULT_ADDRESS_COUNTRY,
  ValidationsService,
} from './validations.service';

const VALID_IBAN = 'DE89370400440532013000';
/** Mastercard's sandbox test IBAN — structurally plausible, checksum-invalid by design. */
const MC_SANDBOX_IBAN = 'FR070331234567890123456';
/** Well-shaped but entirely made up: the case the old structural check called valid. */
const MADE_UP_IBAN = 'XX00AAAAAAAAAAAAAAA';

function make(mode: XbsMode, call?: jest.Mock): ValidationsService {
  const cfg = { mode: () => mode } as unknown as McConfig;
  const gw = { call: call ?? jest.fn() } as unknown as GatewayClient;
  return new ValidationsService(cfg, gw);
}

const acct = (iban: string) => ({ iban }) as unknown as ValidateAccountDto;

describe('ValidationsService — account validation', () => {
  it('live success: reports the Mastercard answer, tagged live', async () => {
    const call = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'SUCCESS' },
    });
    const r = await make('live', call).validateAccount(acct(VALID_IBAN));
    expect(r).toMatchObject({ valid: true, source: 'live' });
  });

  /**
   * This is the F5 case. `GatewayClient.call` returns `{ok:false}` for ANY upstream failure —
   * 401, 403, a 429 from the shared per-tenant throttle, a 5xx, or a network error — and the
   * service then silently answers from the local synthesizer. The response must at minimum
   * say so, because the UI decides what to show from `source`.
   */
  it('live but the gateway is unreachable: falls back and tags the answer demo', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).validateAccount(acct(VALID_IBAN));
    expect(call).toHaveBeenCalled();
    expect(r.source).toBe('demo');
  });

  // Before the checksum was added this returned valid:true — the fallback asserted that a
  // made-up account was good, and the UI rendered that as a Mastercard "Validated" badge.
  it('the fallback does NOT vouch for a made-up account', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).validateAccount(acct(MADE_UP_IBAN));
    expect(r).toMatchObject({ valid: false, source: 'demo' });
  });

  it('the fallback still accepts a genuinely well-formed IBAN', async () => {
    const r = await make('demo').validateAccount(acct(VALID_IBAN));
    expect(r).toMatchObject({ valid: true, source: 'demo' });
  });

  // Documented consequence, asserted so it is a decision rather than a surprise: with the
  // gateway down, the seeded MC sandbox invoice reads as not-valid. Under `live` (the
  // shipped default) Mastercard answers instead and this never surfaces.
  it('the MC sandbox test IBAN reads as invalid in the fallback (by design)', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).validateAccount(acct(MC_SANDBOX_IBAN));
    expect(r).toMatchObject({ valid: false, source: 'demo' });
  });

  it('normalizes spacing and case before deciding', async () => {
    const r = await make('demo').validateAccount(
      acct(' de89 3704 0044 0532 0130 00 '),
    );
    expect(r).toMatchObject({ valid: true, normalized: VALID_IBAN });
  });

  it('demo mode never calls the gateway', async () => {
    const call = jest.fn();
    await make('demo', call).validateAccount(acct(VALID_IBAN));
    expect(call).not.toHaveBeenCalled();
  });
});

const addr = (address: string, country?: string) =>
  ({ address, country }) as unknown as ValidateAddressDto;

describe('ValidationsService — address validation', () => {
  it('live success: reports the Mastercard answer, tagged live and checked', async () => {
    const call = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'VALID', verification: 'VERIFIED' },
    });
    const r = await make('live', call).validateAddress(
      addr('4 CLARK STREET, EVERETT, MA, 02149', 'USA'),
    );
    expect(r).toEqual({
      valid: true,
      checked: true,
      country: 'USA',
      source: 'live',
    });
  });

  it('live INVALID is a real verdict: checked, but not valid', async () => {
    const call = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'INVALID', verification: 'AMBIGUOUS' },
    });
    const r = await make('live', call).validateAddress(
      addr('HaYarkon 99, Tel Aviv, Israel', 'USA'),
    );
    expect(r).toMatchObject({ valid: false, checked: true, source: 'live' });
  });

  /**
   * The fail-open this replaces: the fallback used to answer
   * `valid: req.address.trim().length > 0`, so any non-empty string was a valid beneficiary
   * address. Unlike an IBAN there is no checksum to add — an address simply cannot be
   * verified offline — so the fix is to stop answering rather than to answer better.
   */
  it('the fallback does NOT vouch for an address — it reports that nothing was checked', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).validateAddress(
      addr('literally anything', 'ISR'),
    );
    expect(r).toEqual({
      valid: false,
      checked: false,
      country: 'ISR',
      source: 'demo',
    });
  });

  it('demo mode reports unchecked and never calls the gateway', async () => {
    const call = jest.fn();
    const r = await make('demo', call).validateAddress(addr('anything', 'DEU'));
    expect(call).not.toHaveBeenCalled();
    expect(r).toMatchObject({ valid: false, checked: false, country: 'DEU' });
  });

  // The country is no longer applied invisibly: an omitted one still defaults, but the
  // response says which was used, so "invalid" can be traced to "graded as a US address".
  it('defaults the country when absent and REPORTS the one it used', async () => {
    const call = jest.fn().mockResolvedValue({ ok: false });
    const r = await make('live', call).validateAddress(addr('somewhere'));
    expect(r.country).toBe(DEFAULT_ADDRESS_COUNTRY);
  });

  it('passes the caller country upstream, upper-cased', async () => {
    const call = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, data: { status: 'VALID' } });
    await make('live', call).validateAddress(addr('somewhere', 'isr'));
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { country: 'ISR', address: 'somewhere' },
      }),
    );
  });
});
