import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionStatusEntity } from './transaction-status.entity';
import { TransactionStatusStore } from './transaction-status.store';

/**
 * Владеет персистом статус-событий push-уведомлений (`tx_status`). Выделен в
 * отдельный модуль, т.к. `TransactionStatusStore` нужен ДВУМ потребителям:
 * WebhooksModule (запись входящих событий) и CrossBorderModule (tenant-scoped
 * чтение для polling'а мерчантом). Экспортирует только стор.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TransactionStatusEntity])],
  providers: [TransactionStatusStore],
  exports: [TransactionStatusStore],
})
export class TransactionStatusModule {}
