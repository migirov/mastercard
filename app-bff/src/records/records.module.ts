import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordEntity } from './entities/record.entity';
import { RecordsService } from './services/records.service';
import { RecordsController } from './controllers/records.controller';
import { MiscController } from './controllers/misc.controller';

/**
 * Entity emulation: the generic `records` store + the mocked auth/integrations
 * surface. `RecordsService` is exported so the seed module can populate the store on boot.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RecordEntity])],
  controllers: [RecordsController, MiscController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
