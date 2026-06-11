import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientRegistry } from './client-registry';

const TOKEN_TTL_SECONDS = 900; // 15 минут

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/** Выдача access-token'ов по grant_type=client_credentials. */
@Injectable()
export class OAuthService {
  constructor(
    private readonly clients: ClientRegistry,
    private readonly jwt: JwtService,
  ) {}

  async issueToken(
    clientId: string,
    clientSecret: string,
  ): Promise<TokenResponse> {
    const tenantId = await this.clients.validate(clientId, clientSecret);
    if (!tenantId) {
      throw new UnauthorizedException('invalid_client');
    }
    const access_token = this.jwt.sign(
      { tid: tenantId },
      { subject: clientId, expiresIn: TOKEN_TTL_SECONDS },
    );
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
    };
  }
}
