import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { TenantModule } from '../tenants/tenant.module';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  imports: [TenantModule, AuthModule, AuditModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
