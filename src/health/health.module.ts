import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/** Health-пробы (@nestjs/terminus) для liveness/readiness в Kubernetes. */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
