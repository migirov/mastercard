import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GateService } from '../services/gate.service';
import { GateVerifyDto } from '../dto/gate-verify.dto';
import { GateThrottlerGuard } from '../guards/gate-throttler.guard';

// Per-route validation (no global pipe — the generic /entities CRUD is intentional passthrough
// and must NOT be whitelisted; team-lead issue #12). Strict: strips unknown keys + transforms.
const gatePipe = new ValidationPipe({ whitelist: true, transform: true });

/**
 * The UI access gate's server side.
 *
 * app-bff sets no global prefix, so this is `/gate/verify`; the SPA reaches it as
 * `POST /demo-api/gate/verify` through the existing `location /demo-api/` block in the frontend's
 * nginx, which rewrites the prefix away. No nginx change was needed to add it.
 *
 * Still behind the global `DemoAuthGuard` — the shared bearer token is required here as on every
 * other route, so this endpoint is no more exposed than the rest of the API. What it does NOT
 * require is a gate proof, for the obvious reason that it is what mints one.
 */
@Controller('gate')
@UseGuards(GateThrottlerGuard)
export class GateController {
  constructor(private readonly gate: GateService) {}

  /**
   * 204 on success, 401 on a wrong password.
   *
   * The 401 carries a machine-readable `code` so the SPA can branch on data rather than on a
   * status alone — it must distinguish "wrong password" from "rate-limited" from "backend down",
   * and the gate screen shows a different message for each.
   */
  @Post('verify')
  @HttpCode(204)
  @Throttle({ gate: { limit: 10, ttl: 900_000 } })
  @UsePipes(gatePipe)
  verify(@Body() body: GateVerifyDto): void {
    if (!this.gate.verify(body.password)) {
      throw new UnauthorizedException({
        code: 'gate_bad_password',
        message: 'incorrect password',
      });
    }
  }
}
