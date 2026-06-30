import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionStatusEntity } from './entities/transaction-status.entity';
import { TransactionStatusStore } from './services/transaction-status.store';

/**
 * Owns persistence of push-notification status events (`tx_status`). Split into its own
 * module because `TransactionStatusStore` is needed by TWO consumers: WebhooksModule
 * (writing incoming events) and CrossBorderModule (tenant-scoped reads for merchant
 * polling). Exports only the store.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TransactionStatusEntity])],
  providers: [TransactionStatusStore],
  exports: [TransactionStatusStore],
})
export class TransactionStatusModule {}
