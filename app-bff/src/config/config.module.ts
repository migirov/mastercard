import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

/**
 * Provides the typed `AppConfig` application-wide. `@Global` so every feature
 * module can inject it without re-importing (it wraps the already-global
 * `ConfigService`). Mirrors how the gateway provides its `GatewayConfig` globally.
 */
@Global()
@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
