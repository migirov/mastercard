import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { TenantRegistry } from './services/tenant.registry';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenantRegistry],
  exports: [TenantRegistry],
})
export class TenantModule {}
