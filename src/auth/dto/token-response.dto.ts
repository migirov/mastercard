import { ApiProperty } from '@nestjs/swagger';

/** Ответ `POST /oauth/token` (OAuth2). Для типизации и Swagger-схемы. */
export class TokenResponseDto {
  @ApiProperty({ description: 'JWT доступа (HS256, issuer mc-gateway).' })
  access_token!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  token_type!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Время жизни токена, секунды.' })
  expires_in!: number;
}
