import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';

/**
 * Auditing is attached PER-CONTROLLER (`@UseInterceptors(AuditInterceptor)` on our
 * controllers), NOT globally via APP_INTERCEPTOR — the module is embeddable and must not
 * wrap the whole host application's traffic. Hence we export `AuditInterceptor` so
 * controller modules can attach it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
