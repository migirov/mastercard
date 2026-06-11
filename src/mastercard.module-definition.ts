import { ConfigurableModuleBuilder } from '@nestjs/common';
import { MastercardModuleOptions } from './config/gateway-config';

/**
 * Генерирует `forRoot()` / `forRootAsync()` + `MODULE_OPTIONS_TOKEN` для
 * зонтичного `MastercardModule`. `isGlobal: true` по умолчанию — чтобы
 * `GatewayConfig`, экспортируемый зонтичным модулем, был доступен всем
 * под-модулям без явного импорта.
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
