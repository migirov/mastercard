import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module';
import { CredentialsService } from './services/credentials.service';

@Module({
  imports: [SecretsModule],
  providers: [CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
