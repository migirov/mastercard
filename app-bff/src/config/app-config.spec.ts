import { ConfigService } from '@nestjs/config';
import { AppConfig, DEV_CORS_ORIGINS } from './app-config';

function make(env: Record<string, string> = {}): AppConfig {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new AppConfig(config);
}

describe('AppConfig.demoApiToken', () => {
  it('returns the configured token', () => {
    expect(make({ DEMO_API_TOKEN: 'tok' }).demoApiToken).toBe('tok');
  });

  // '' is the DENY signal `matchSharedToken` looks for. If this ever gained a literal
  // fallback, that fallback would be published in this repo and the guard would accept it.
  it('returns an empty string when unset — never a default token', () => {
    expect(make().demoApiToken).toBe('');
  });
});

describe('AppConfig.demoGatePassword', () => {
  it('returns the configured password', () => {
    expect(make({ DEMO_GATE_PASSWORD: 'pw' }).demoGatePassword).toBe('pw');
  });

  // Same DENY signal as demoApiToken, and the stakes are the same: a literal fallback here would
  // be published in this repo, and the gate would then open for anyone who read it.
  it('returns an empty string when unset — never a default password', () => {
    expect(make().demoGatePassword).toBe('');
  });

  // The password must live ONLY in backend env. This pins that it is not read from, and cannot be
  // satisfied by, the variable the frontend bundle used to carry.
  it('does not fall back to any other variable', () => {
    expect(make({ DEMO_API_TOKEN: 'tok' }).demoGatePassword).toBe('');
  });
});

describe('AppConfig.demoGateSecret', () => {
  it('returns the configured secret', () => {
    expect(make({ DEMO_GATE_SECRET: 'sek' }).demoGateSecret).toBe('sek');
  });

  // '' is DENY for verifyGateProof, so a forgotten variable serves 401s instead of accepting
  // forged proofs. A literal default would be published here and would forge cleanly.
  it('returns an empty string when unset — never a default secret', () => {
    expect(make().demoGateSecret).toBe('');
  });

  // The signing key and the human password are separate values; neither may stand in for the other.
  it('is independent of DEMO_GATE_PASSWORD', () => {
    const cfg = make({ DEMO_GATE_PASSWORD: 'pw' });
    expect(cfg.demoGateSecret).toBe('');
    expect(cfg.demoGatePassword).toBe('pw');
  });
});

describe('AppConfig.demoGateTtlHours', () => {
  it('defaults to 12 hours when unset', () => {
    expect(make().demoGateTtlHours).toBe(12);
  });

  it('honours an override', () => {
    expect(make({ DEMO_GATE_TTL_HOURS: '1' }).demoGateTtlHours).toBe(1);
  });

  // Number('') and Number('abc') are 0 and NaN — both falsy, so the `|| 12` keeps a bad value from
  // producing a zero-second session that expires the instant it is issued.
  it.each([
    ['', 12],
    ['abc', 12],
    ['0', 12],
  ])('falls back to 12 for a non-positive value (%s)', (raw, expected) => {
    expect(make({ DEMO_GATE_TTL_HOURS: raw }).demoGateTtlHours).toBe(expected);
  });
});

describe('AppConfig.corsOrigins', () => {
  it('falls back to the localhost dev origins when unset', () => {
    expect(make().corsOrigins).toEqual([...DEV_CORS_ORIGINS]);
  });

  it('splits a comma-separated list and trims each entry', () => {
    expect(
      make({ CORS_ORIGINS: 'https://a.example , https://b.example' })
        .corsOrigins,
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  // A trailing comma must not yield an empty-string origin: the `cors` package compares the
  // request's Origin against the list, and '' would be a stray entry that matches nothing —
  // harmless here, but it keeps the allowlist exactly what the operator wrote.
  it('drops empty segments from a trailing comma', () => {
    expect(make({ CORS_ORIGINS: 'https://a.example,' }).corsOrigins).toEqual([
      'https://a.example',
    ]);
  });
});
