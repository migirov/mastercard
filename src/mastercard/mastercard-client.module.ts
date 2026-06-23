import { Module } from '@nestjs/common';
import { EncryptionService } from '../encryption/services/encryption.service';
import { MastercardClient } from './services/mastercard-client.service';

/**
 * Low-level Mastercard client (axios + encrypt/sign/decrypt interceptors).
 * `EncryptionService` is a private provider of this same module (its only
 * consumer is `MastercardClient`), so a separate module for it is unnecessary.
 */
@Module({
  providers: [EncryptionService, MastercardClient],
  exports: [MastercardClient],
})
export class MastercardClientModule {}
