import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RecordsService } from '../../records/services/records.service';
import { SEED_DATA } from '../seed-data';

/**
 * Populates the demo store on boot so the frontend is never empty. Mirrors the
 * gateway's `DevSeedService` convention (a dev-harness `OnApplicationBootstrap`
 * seeder, kept OUT of the data layer). Idempotent: for each entity type it seeds ONLY
 * when that type is currently empty, so restarts don't duplicate rows and any edits
 * made during the demo survive.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly records: RecordsService) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const [entityType, rows] of Object.entries(SEED_DATA)) {
      const existing = await this.records.count(entityType);
      if (existing > 0) continue; // already seeded — leave it alone
      for (const data of rows) {
        await this.records.create(entityType, data);
      }
      this.logger.log(`Seeded ${rows.length} ${entityType} row(s)`);
    }
  }
}
