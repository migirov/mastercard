import { ConfigurableModuleBuilder } from '@nestjs/common';
import { MastercardModuleOptions } from './config/gateway-config';

/**
 * Generates `forRoot()` / `forRootAsync()` + `MODULE_OPTIONS_TOKEN` for the umbrella
 * `MastercardModule`. `isGlobal: true` by default — so `GatewayConfig`, exported by the
 * umbrella module, is available to all sub-modules without an explicit import.
 */
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<MastercardModuleOptions>()
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: true }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();
