import { Module } from '@nestjs/common';
import { EncryptionService } from '../encryption/encryption.service';
import { MastercardClient } from './mastercard-client.service';

/**
 * Низкоуровневый клиент Mastercard (axios + интерцепторы encrypt/sign/decrypt).
 * `EncryptionService` — приватный провайдер этого же модуля (единственный
 * потребитель — `MastercardClient`), отдельный модуль для него избыточен.
 */
@Module({
  providers: [EncryptionService, MastercardClient],
  exports: [MastercardClient],
})
export class MastercardClientModule {}
