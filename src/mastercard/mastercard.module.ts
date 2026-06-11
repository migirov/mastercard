import { Module } from '@nestjs/common';
import { EncryptionModule } from '../encryption/encryption.module';
import { MastercardClient } from './mastercard-client.service';

@Module({
  imports: [EncryptionModule],
  providers: [MastercardClient],
  exports: [MastercardClient],
})
export class MastercardModule {}
