import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response when issuing an OAuth client. The ONLY endpoint that returns the raw
 * `client_secret` — and only ONCE (the DB stores only its hash). Fields are
 * `@Expose` because here the secret MUST be shown; `excludeExtraneousValues` in
 * the controller guarantees that exactly these three fields, and nothing extra
 * from the internal client representation, are exposed.
 */
export class IssuedClientDto {
  @Expose()
  @ApiProperty({ description: 'OAuth client identifier.' })
  clientId!: string;

  @Expose()
  @ApiProperty({ description: 'Raw client_secret — shown ONCE.' })
  clientSecret!: string;

  @Expose()
  @ApiProperty({ description: 'Reminder to save the secret.' })
  note!: string;
}
