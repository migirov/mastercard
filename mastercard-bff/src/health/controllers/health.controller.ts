import { Controller, Get } from '@nestjs/common';
import { McConfig } from '../../config/mc-config';

@Controller()
export class HealthController {
  constructor(private readonly cfg: McConfig) {}

  @Get('health')
  health() {
    // Surface the per-capability live|demo wiring so the demo is self-documenting.
    return {
      status: 'ok',
      service: 'mastercard-bff',
      xbs: this.cfg.modes,
      features: this.cfg.featureModes,
    };
  }
}
