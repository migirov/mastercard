import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SECRET_STORE } from './secret-store.types';
import { LocalSecretStore } from './local-secret-store';
import { VaultSecretStore } from './vault-secret-store';

/**
 * Выбор реализации хранилища секретов по MC_SECRET_STORE:
 *   'vault' → VaultSecretStore (прод), иначе → LocalSecretStore (dev, по умолчанию).
 */
@Module({
  providers: [
    LocalSecretStore,
    VaultSecretStore,
    {
      provide: SECRET_STORE,
      useFactory: (
        config: ConfigService,
        local: LocalSecretStore,
        vault: VaultSecretStore,
      ) =>
        config.get<string>('MC_SECRET_STORE') === 'vault' ? vault : local,
      inject: [ConfigService, LocalSecretStore, VaultSecretStore],
    },
  ],
  exports: [SECRET_STORE],
})
export class SecretsModule {}
