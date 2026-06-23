import { Module } from '@nestjs/common';
import { GatewayConfig } from '../config/gateway-config';
import { SECRET_STORE } from './secret-store.types';
import { LocalSecretStore } from './services/local-secret-store';
import { VaultSecretStore } from './services/vault-secret-store';

/**
 * Selects the secret store implementation based on the `secretStore` module option:
 *   'vault' → VaultSecretStore (prod), otherwise → LocalSecretStore (dev, default).
 */
@Module({
  providers: [
    LocalSecretStore,
    VaultSecretStore,
    {
      provide: SECRET_STORE,
      useFactory: (
        config: GatewayConfig,
        local: LocalSecretStore,
        vault: VaultSecretStore,
      ) => (config.secretStore === 'vault' ? vault : local),
      inject: [GatewayConfig, LocalSecretStore, VaultSecretStore],
    },
  ],
  exports: [SECRET_STORE],
})
export class SecretsModule {}
