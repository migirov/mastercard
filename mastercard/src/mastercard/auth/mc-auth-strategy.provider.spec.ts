import { Test } from '@nestjs/testing';
import { GatewayConfig } from '../../config/gateway-config';
import { MC_AUTH_STRATEGY, McAuthMode, McAuthStrategy } from './mc-auth.types';
import { OAuth1Strategy } from './services/oauth1.strategy';
import { OAuth2RequestTokenStrategy } from './services/oauth2-request-token.strategy';
import { MC_AUTH_STRATEGY_PROVIDER } from './mc-auth.provider';

/**
 * The one assertion that matters most in the dual-mode change: a single inverted
 * ternary in the factory would sign every PSD2 call with OAuth 1.0a — which the EU
 * edge rejects exactly like an unauthenticated request — and nothing else would fail.
 * Module wiring is what `Test.createTestingModule` is for.
 */
async function resolveStrategy(
  authMode: McAuthMode | undefined,
): Promise<McAuthStrategy> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: GatewayConfig, useValue: { authMode } as GatewayConfig },
      OAuth1Strategy,
      OAuth2RequestTokenStrategy,
      MC_AUTH_STRATEGY_PROVIDER,
    ],
  }).compile();

  return moduleRef.get<McAuthStrategy>(MC_AUTH_STRATEGY);
}

describe('MC_AUTH_STRATEGY provider', () => {
  it('selects the OAuth2 request-token strategy for the PSD2 edges', async () => {
    const strategy = await resolveStrategy('oauth2-request-token');

    expect(strategy).toBeInstanceOf(OAuth2RequestTokenStrategy);
    expect(strategy.mode).toBe('oauth2-request-token');
  });

  it('selects OAuth 1.0a when the mode says so', async () => {
    const strategy = await resolveStrategy('oauth1');

    expect(strategy).toBeInstanceOf(OAuth1Strategy);
    expect(strategy.mode).toBe('oauth1');
  });

  it('defaults to OAuth 1.0a when the mode is unset — existing deployments unchanged', async () => {
    const strategy = await resolveStrategy(undefined);

    expect(strategy).toBeInstanceOf(OAuth1Strategy);
  });
});
