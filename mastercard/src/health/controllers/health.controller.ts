import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

/**
 * Health probes for the orchestrator (Kubernetes). Public (no auth) — called by
 * the kubelet/LB.
 *   GET /health — liveness: the process is alive (no external dependencies).
 *   GET /ready  — readiness: ready to serve (has a connection to Postgres).
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Liveness (the process is alive, no external dependencies).',
  })
  @HealthCheck()
  live() {
    // Empty set of checks: 200 as long as the process responds. The DB is NOT
    // included here — liveness must not kill the pod over a temporary DB outage.
    return this.health.check([]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness (has a connection to Postgres).' })
  @HealthCheck()
  ready() {
    // Readiness: ping the DB. If the DB is unavailable, the pod is taken out of
    // rotation (503) but not restarted.
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
  }
}
