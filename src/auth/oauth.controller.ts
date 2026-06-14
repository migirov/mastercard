import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { GatewayExceptionFilter } from '../common/gateway-exception.filter';
import { OAuthThrottlerGuard } from '../common/oauth-throttler.guard';
import { strictDtoPipe } from '../common/validation.pipe';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { OAuthService } from './oauth.service';

/** OAuth2 token endpoint (публичный — сам и есть точка аутентификации). */
@ApiTags('oauth')
@Controller('oauth')
@UseGuards(OAuthThrottlerGuard) // лимит по client_id — защита от brute-force секретов
@UsePipes(strictDtoPipe()) // строгая валидация тела на нашей границе
@UseFilters(GatewayExceptionFilter) // ошибки токена — в формате RFC 6749 §5.2
@UseInterceptors(AuditInterceptor) // audit-лог по /oauth
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Post('token')
  @ApiOperation({
    summary: 'Выдать access-token (grant_type=client_credentials).',
  })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'invalid_client.' })
  @HttpCode(200)
  // Жёсткий лимит на подбор client_secret: 10 запросов/мин по client_id
  // (OAuthThrottlerGuard трекает по client_id, IP — лишь фолбэк для кривых запросов).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Токены не должны кэшироваться (RFC 6749 §5.1).
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(
    @Body() body: TokenRequestDto,
    @Headers('authorization') authHeader?: string,
  ) {
    // grant_type валидируется DTO (@IsIn). Креды могут прийти из тела или Basic —
    // их наличие проверяем после извлечения (это auth, не валидация схемы).
    const { clientId, clientSecret } = extractCreds(body, authHeader);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('invalid_client');
    }
    return this.oauth.issueToken(clientId, clientSecret);
  }
}

/** client_id/secret — из тела или из заголовка Basic (RFC 6749 §2.3.1). */
function extractCreds(
  body: TokenRequestDto,
  authHeader?: string,
): { clientId?: string; clientSecret?: string } {
  if (body.client_id && body.client_secret) {
    return { clientId: body.client_id, clientSecret: body.client_secret };
  }
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    // i > 0 (а не >= 0): пустой client_id (":secret") — невалиден. Согласовано с
    // OAuthThrottlerGuard.clientIdFrom, чтобы оба парсера трактовали вход одинаково.
    if (i > 0) {
      return {
        clientId: decoded.slice(0, i),
        clientSecret: decoded.slice(i + 1),
      };
    }
  }
  return {};
}
