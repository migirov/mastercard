import { ApiProperty } from '@nestjs/swagger';

/** Response of `POST /oauth/token` (OAuth2). For typing and the Swagger schema. */
export class TokenResponseDto {
  @ApiProperty({ description: 'Access JWT (HS256, issuer mc-gateway).' })
  access_token!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  token_type!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Token lifetime, in seconds.' })
  expires_in!: number;
}
