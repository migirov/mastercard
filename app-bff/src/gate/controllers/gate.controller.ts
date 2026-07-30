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
import { GateProof } from '../../common/utils/gate-proof.util';

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
   * 200 with a signed proof on success, 401 on a wrong password.
   *
   * The proof is what both BFFs' `DemoAuthGuard` demands on every subsequent request, as a second
   * factor alongside the bearer token. It is returned in the body rather than set as a cookie: the
   * SPA sends it back in `X-XBS-Gate`, which is not an ambient credential and therefore carries no
   * CSRF surface, needs no `credentials` change in `demoApi`, and needs no nginx change at all.
   *
   * `expiresAt` lets the SPA decide whether to show the gate on load without a round-trip. It is
   * advisory only — the signed copy inside the proof is what the servers enforce.
   *
   * The 401 carries a machine-readable `code` so the SPA can branch on data rather than on a
   * status alone — it must distinguish "wrong password" from "rate-limited" from "backend down",
   * and the gate screen shows a different message for each.
   */
  @Post('verify')
  @HttpCode(200)
  @Throttle({ gate: { limit: 10, ttl: 900_000 } })
  @UsePipes(gatePipe)
  verify(@Body() body: GateVerifyDto): GateProof {
    if (!this.gate.verify(body.password)) {
      throw new UnauthorizedException({
        code: 'gate_bad_password',
        message: 'incorrect password',
      });
    }
    return this.gate.issueProof();
  }
}
