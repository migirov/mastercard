import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';

/**
 * Аудит навешивается ПЕР-КОНТРОЛЛЕРНО (`@UseInterceptors(AuditInterceptor)` на
 * наших контроллерах), а НЕ глобально через APP_INTERCEPTOR — модуль встраиваемый
 * и не должен оборачивать трафик всего хост-приложения. Поэтому экспортируем
 * `AuditInterceptor`, чтобы модули контроллеров могли его навесить.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
