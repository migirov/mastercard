import { Module } from '@nestjs/common';
import { EncryptionService } from '../encryption/services/encryption.service';
import { MC_AUTH_STRATEGY_PROVIDER } from './auth/mc-auth.provider';
import { OAuth1Strategy } from './auth/services/oauth1.strategy';
import { OAuth2RequestTokenStrategy } from './auth/services/oauth2-request-token.strategy';
import { McAgentProvider } from './services/mc-agent.provider';
import { MastercardClient } from './services/mastercard-client.service';

/**
 * Low-level Mastercard client (axios + encrypt/authenticate/decrypt interceptors).
 * `EncryptionService` is provided here (its main consumer is `MastercardClient`) and
 * exported so `WebhookHandler` can also decrypt incoming push notifications.
 *
 * The outbound auth scheme is bound behind `MC_AUTH_STRATEGY` — the same shape as
 * the `SECRET_STORE` token in `SecretsModule`. It is deliberately NOT exported: only
 * `MastercardClient` may authenticate, so nothing outside can bypass mode selection.
 */
@Module({
  providers: [
    EncryptionService,
    OAuth1Strategy,
    OAuth2RequestTokenStrategy,
    MC_AUTH_STRATEGY_PROVIDER,
    McAgentProvider,
    MastercardClient,
  ],
  exports: [MastercardClient, EncryptionService],
})
export class MastercardClientModule {}
