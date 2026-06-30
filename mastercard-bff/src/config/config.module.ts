import { Global, Module } from '@nestjs/common';
import { McConfig } from './mc-config';

/**
 * Provides the typed `McConfig` application-wide. `@Global` so every feature
 * module can inject it without re-importing (it wraps the already-global
 * `ConfigService`). Mirrors how the gateway provides its `GatewayConfig` globally.
 */
@Global()
@Module({
  providers: [McConfig],
  exports: [McConfig],
})
export class McConfigModule {}
