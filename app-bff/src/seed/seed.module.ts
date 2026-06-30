import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { SeedService } from './services/seed.service';

/**
 * Boot-time demo seeding. Depends on `RecordsModule` (it writes through
 * `RecordsService`), kept separate from it so the data layer carries no seed logic —
 * the same split the gateway uses (`DevSeedService` in the harness, not the registry).
 */
@Module({
  imports: [RecordsModule],
  providers: [SeedService],
})
export class SeedModule {}
