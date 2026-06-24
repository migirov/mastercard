import { Module } from '@nestjs/common';
import { EncryptionService } from '../encryption/services/encryption.service';
import { MastercardClient } from './services/mastercard-client.service';

/**
 * Low-level Mastercard client (axios + encrypt/sign/decrypt interceptors).
 * `EncryptionService` is provided here (its main consumer is `MastercardClient`) and
 * exported so `WebhookHandler` can also decrypt incoming push notifications.
 */
@Module({
  providers: [EncryptionService, MastercardClient],
  exports: [MastercardClient, EncryptionService],
})
export class MastercardClientModule {}
