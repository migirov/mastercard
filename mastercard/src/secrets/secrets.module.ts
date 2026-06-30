import { Module } from '@nestjs/common';
import { GatewayConfig } from '../config/gateway-config';
import { SECRET_STORE } from './secret-store.types';
import { LocalSecretStore } from './services/local-secret-store';
import { AwsSecretsManagerSecretStore } from './services/aws-secrets-manager-secret-store';

/**
 * Selects the secret store implementation based on the `secretStore` module option:
 *   'aws-secrets-manager' → AwsSecretsManagerSecretStore (prod),
 *   otherwise → LocalSecretStore (dev, default).
 */
@Module({
  providers: [
    LocalSecretStore,
    AwsSecretsManagerSecretStore,
    {
      provide: SECRET_STORE,
      useFactory: (
        config: GatewayConfig,
        local: LocalSecretStore,
        aws: AwsSecretsManagerSecretStore,
      ) => (config.secretStore === 'aws-secrets-manager' ? aws : local),
      inject: [GatewayConfig, LocalSecretStore, AwsSecretsManagerSecretStore],
    },
  ],
  exports: [SECRET_STORE],
})
export class SecretsModule {}
