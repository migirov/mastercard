import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UseGatewayContract } from '../../common/decorators/gateway-contract.decorator';
import { parseClientCredentials } from '../../common/utils/oauth-credentials';
import { OAuthThrottlerGuard } from '../../common/guards/oauth-throttler.guard';
import { strictDtoPipe } from '../../common/pipes/validation.pipe';
import { TokenRequestDto } from '../dto/token-request.dto';
import { TokenResponseDto } from '../dto/token-response.dto';
import { OAuthService } from '../services/oauth.service';

/** OAuth2 token endpoint (публичный — сам и есть точка аутентификации). */
@ApiTags('oauth')
@Controller('oauth')
@UseGuards(OAuthThrottlerGuard) // лимит по client_id — защита от brute-force секретов
@UsePipes(strictDtoPipe()) // строгая валидация тела на нашей границе
@UseGatewayContract() // error-контракт (RFC 6749 §5.2 для /oauth/token) + audit
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
    // их наличие проверяем после извлечения (это auth, не валидация схемы). Парсер
    // общий с OAuthThrottlerGuard — личность запроса трактуется одинаково.
    const { clientId, clientSecret } = parseClientCredentials(body, authHeader);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('invalid_client');
    }
    return this.oauth.issueToken(clientId, clientSecret);
  }
}
