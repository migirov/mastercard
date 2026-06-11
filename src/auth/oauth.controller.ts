import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OAuthThrottlerGuard } from '../common/oauth-throttler.guard';
import { OAuthService } from './oauth.service';

interface TokenBody {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
}

/** OAuth2 token endpoint (публичный — сам и есть точка аутентификации). */
@Controller('oauth')
@UseGuards(OAuthThrottlerGuard) // лимит по client_id — защита от brute-force секретов
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Post('token')
  @HttpCode(200)
  // Жёсткий лимит на подбор client_secret: 10 запросов / минуту с IP.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Токены не должны кэшироваться (RFC 6749 §5.1).
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: TokenBody, @Headers('authorization') authHeader?: string) {
    if (body?.grant_type !== 'client_credentials') {
      throw new BadRequestException('unsupported_grant_type');
    }
    const { clientId, clientSecret } = extractCreds(body, authHeader);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('invalid_client');
    }
    return this.oauth.issueToken(clientId, clientSecret);
  }
}

/** client_id/secret — из тела или из заголовка Basic (RFC 6749 §2.3.1). */
function extractCreds(
  body: TokenBody,
  authHeader?: string,
): { clientId?: string; clientSecret?: string } {
  if (body.client_id && body.client_secret) {
    return { clientId: body.client_id, clientSecret: body.client_secret };
  }
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i >= 0) {
      return { clientId: decoded.slice(0, i), clientSecret: decoded.slice(i + 1) };
    }
  }
  return {};
}
