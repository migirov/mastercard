import { Controller, Get } from '@nestjs/common';
import { McConfig } from '../../config/mc-config';

@Controller()
export class HealthController {
  constructor(private readonly cfg: McConfig) {}

  @Get('health')
  health() {
    // Surface the per-capability live|demo wiring so the demo is self-documenting. `xbs`/
    // `features` are the CONFIGURED modes; `effective` is what a caller actually gets — a
    // `live` capability with no gateway token silently serves synthesized data, so an operator
    // checking "are we live?" must see the effective view, not just the configured one.
    return {
      status: 'ok',
      service: 'mastercard-bff',
      gatewayConfigured: this.cfg.gatewayConfigured,
      xbs: this.cfg.modes,
      features: this.cfg.featureModes,
      effective: {
        xbs: this.cfg.effectiveModes,
        features: this.cfg.effectiveFeatureModes,
      },
    };
  }
}
