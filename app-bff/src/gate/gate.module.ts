import { Module } from '@nestjs/common';
import { GateController } from './controllers/gate.controller';
import { GateService } from './services/gate.service';
import { GateThrottlerGuard } from './guards/gate-throttler.guard';

/**
 * The UI access gate: one endpoint that checks the typed password against `DEMO_GATE_PASSWORD`.
 *
 * `ThrottlerModule` is registered once in `AppModule` (it is `@Global()` in v5, so its providers
 * are visible here without importing it). `GateThrottlerGuard` is provided as a normal provider
 * and applied with `@UseGuards` on the controller — deliberately NOT as an `APP_GUARD`, which
 * would throttle the generic `/entities` CRUD that the demo walkthrough hammers.
 *
 * Nothing is exported: the gate is a leaf, and the password must not become reachable from
 * elsewhere in the app.
 */
@Module({
  controllers: [GateController],
  providers: [GateService, GateThrottlerGuard],
})
export class GateModule {}
