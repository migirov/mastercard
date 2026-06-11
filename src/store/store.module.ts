import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KvEntity } from '../database/entities/kv.entity';
import { PostgresKvStore } from './postgres-kv.store';
import { KV_STORE } from './kv.types';

/** KV-хранилище поверх PostgreSQL (идемпотентность, дедуп вебхуков). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([KvEntity])],
  providers: [
    PostgresKvStore,
    { provide: KV_STORE, useExisting: PostgresKvStore },
  ],
  exports: [KV_STORE],
})
export class StoreModule {}
