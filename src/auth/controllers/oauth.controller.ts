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
import {
  gatewayValidationPipe,
  ValidationStrategy,
} from '../../common/pipes/gateway-validation.pipe';
import { TokenRequestDto } from '../dto/token-request.dto';
import { TokenResponseDto } from '../dto/token-response.dto';
import { OAuthService } from '../services/oauth.service';

/** OAuth2 token endpoint (public — it is itself the authentication point). */
@ApiTags('oauth')
@Controller('oauth')
@UseGuards(OAuthThrottlerGuard) // per-client_id limit — protection against secret brute-forcing
// Strict body validation at our boundary (shared gateway strategy, Strict preset).
@UsePipes(gatewayValidationPipe(ValidationStrategy.Strict))
@UseGatewayContract() // error contract (RFC 6749 §5.2 for /oauth/token) + audit
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Post('token')
  @ApiOperation({
    summary: 'Issue an access token (grant_type=client_credentials).',
  })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'invalid_client.' })
  @HttpCode(200)
  // Hard limit on client_secret guessing: 10 requests/min per client_id
  // (OAuthThrottlerGuard tracks by client_id; IP is only a fallback for malformed requests).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Tokens must not be cached (RFC 6749 §5.1).
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(
    @Body() body: TokenRequestDto,
    @Headers('authorization') authHeader?: string,
  ) {
    // grant_type is validated by the DTO (@IsIn). Credentials may arrive in the body
    // or via Basic — we check their presence after extraction (this is auth, not schema
    // validation). The parser is shared with OAuthThrottlerGuard, so the request identity
    // is interpreted the same way.
    const { clientId, clientSecret } = parseClientCredentials(body, authHeader);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('invalid_client');
    }
    return this.oauth.issueToken(clientId, clientSecret);
  }
}
