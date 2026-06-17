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
        // Алгоритм пинуется явно (HS256) и на подписи, и на проверке — защита
        // от algorithm-confusion / 'none'. issuer + audience проверяются: aud
        // привязывает merchant-токен к нашему API (нельзя переиграть в другой
        // JWT-потребитель). maxAge — независимый от подписи потолок TTL: даже
        // если signer когда-то поднимет expiresIn, verify не примет токен старше
        // 15м (дублирует exp по claim iat).
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
