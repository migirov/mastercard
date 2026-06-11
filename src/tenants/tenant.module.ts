import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '../database/entities/tenant.entity';
import { TenantRegistry } from './tenant.registry';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenantRegistry],
  exports: [TenantRegistry],
})
export class TenantModule {}
