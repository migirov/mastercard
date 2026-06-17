import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module';
import { CredentialsService } from './services/credentials.service';
import { OwnCredentialsProvider } from './services/own-credentials.provider';
import { PlatformCredentialsProvider } from './services/platform-credentials.provider';

@Module({
  imports: [SecretsModule],
  // Only the facade is exported; the per-mode providers are private collaborators.
  providers: [
    CredentialsService,
    PlatformCredentialsProvider,
    OwnCredentialsProvider,
  ],
  exports: [CredentialsService],
})
export class CredentialsModule {}
