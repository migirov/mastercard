import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { GatewayConfig } from '../config/gateway-config';
import { OAuthClientEntity } from './entities/oauth-client.entity';
import { TenantModule } from '../tenants/tenant.module';
import { ClientRegistry } from './services/client-registry';
import { OAuthService } from './services/oauth.service';
import { OAuthController } from './controllers/oauth.controller';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { OAuthThrottlerGuard } from '../common/guards/oauth-throttler.guard';

@Module({
  imports: [
    TenantModule,
    AuditModule,
    TypeOrmModule.forFeature([OAuthClientEntity]),
    JwtModule.registerAsync({
      inject: [GatewayConfig],
      useFactory: (config: GatewayConfig) => {
        const secret = config.jwtSecret;
        if (!secret) {
          throw new Error('MastercardModule option "jwtSecret" is not set');
        }
        // The algorithm is pinned explicitly (HS256) on both signing and verification
        // — protection against algorithm-confusion / 'none'. issuer + audience are
        // verified: aud binds the merchant token to our API (it cannot be replayed against
        // another JWT consumer). maxAge is a TTL ceiling independent of the signature: even
        // if the signer ever raises expiresIn, verify will not accept a token older than
        // 15m (duplicates exp via the iat claim).
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            issuer: 'mc-gateway',
            audience: 'mc-gateway-merchant',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'mc-gateway',
            audience: 'mc-gateway-merchant',
            maxAge: '15m',
          },
        };
      },
    }),
  ],
  providers: [
    ClientRegistry,
    OAuthService,
    TenantAuthGuard,
    AdminAuthGuard,
    OAuthThrottlerGuard,
  ],
  controllers: [OAuthController],
  exports: [ClientRegistry, TenantAuthGuard, AdminAuthGuard, JwtModule],
})
export class AuthModule {}
