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
