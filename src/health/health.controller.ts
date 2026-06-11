import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

/**
 * Health-пробы для оркестратора (Kubernetes). Публичные (без auth) — их дёргают
 * kubelet/LB.
 *   GET /health — liveness: процесс жив (без внешних зависимостей).
 *   GET /ready  — readiness: готов обслуживать (есть коннект к Postgres).
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness (процесс жив, без внешних зависимостей).' })
  @HealthCheck()
  live() {
    // Пустой набор проверок: 200, пока процесс отвечает. БД сюда НЕ включаем —
    // liveness не должен ронять под из-за временной недоступности БД.
    return this.health.check([]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness (есть коннект к Postgres).' })
  @HealthCheck()
  ready() {
    // Readiness: пинг БД. Если БД недоступна — под выводится из ротации (503),
    // но не перезапускается.
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
  }
}
