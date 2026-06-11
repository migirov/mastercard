import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayConfig } from '../config/gateway-config';
import { OAuthClientEntity } from '../database/entities/oauth-client.entity';
import { TenantModule } from '../tenants/tenant.module';
import { ClientRegistry } from './client-registry';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { OAuthThrottlerGuard } from '../common/oauth-throttler.guard';

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([OAuthClientEntity]),
    JwtModule.registerAsync({
      inject: [GatewayConfig],
      useFactory: (config: GatewayConfig) => {
        const secret = config.jwtSecret;
        if (!secret) {
          throw new Error('MastercardModule option "jwtSecret" is not set');
        }
        // Алгоритм пинуется явно (HS256) и на подписи, и на проверке — защита
        // от algorithm-confusion / 'none'. issuer тоже проверяется.
        return {
          secret,
          signOptions: { algorithm: 'HS256', issuer: 'mc-gateway' },
          verifyOptions: { algorithms: ['HS256'], issuer: 'mc-gateway' },
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
