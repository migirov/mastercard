import { McConfig, XbsMode } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { ValidateAccountDto } from '../dto/validate-account.dto';
import { ValidationsService } from './validations.service';

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
