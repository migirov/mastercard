import { Provider } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { MC_AUTH_STRATEGY } from './mc-auth.types';
import { OAuth1Strategy } from './services/oauth1.strategy';
import { OAuth2RequestTokenStrategy } from './services/oauth2-request-token.strategy';

/**
 * Binds `MC_AUTH_STRATEGY` to the scheme the configuration selects. Extracted from
 * `MastercardClientModule` so the selection itself is testable in isolation — an
 * inverted condition here would silently authenticate every PSD2 call the wrong way.
 *
 * A `useFactory` (rather than a dynamic `useClass`) because the predicate lives on a
 * DI-resolved `GatewayConfig`: this module never reads `process.env`, so the decision
 * cannot be made at module-evaluation time.
 */
export const MC_AUTH_STRATEGY_PROVIDER: Provider = {
  provide: MC_AUTH_STRATEGY,
  useFactory: (
    config: GatewayConfig,
    oauth1: OAuth1Strategy,
    oauth2: OAuth2RequestTokenStrategy,
  ) => (config.authMode === 'oauth2-request-token' ? oauth2 : oauth1),
  inject: [GatewayConfig, OAuth1Strategy, OAuth2RequestTokenStrategy],
};
