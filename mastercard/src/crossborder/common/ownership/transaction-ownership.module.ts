import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionOwnershipEntity } from '../entities/transaction-ownership.entity';
import { TransactionOwnership } from './transaction-ownership.service';

/**
 * Owns the resource→tenant binding (`tx_ownership`) that authorizes PLATFORM sub-merchants.
 * Split into its own module for the same reason as TransactionStatusModule: it has TWO
 * consumers — CrossBorderModule (claiming on quote/payment, gating reads and cancels) and
 * WebhooksModule (corroborating the unauthenticated `partnerId` on an inbound push).
 * Exports only the service.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TransactionOwnershipEntity])],
  providers: [TransactionOwnership],
  exports: [TransactionOwnership],
})
export class TransactionOwnershipModule {}
