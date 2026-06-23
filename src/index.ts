/**
 * Public API of the embeddable module — the SINGLE point from which the host
 * application (`b24club-api`) imports symbols. Frees the host from deep imports along
 * internal paths (which may change). Anything NOT re-exported here is a private
 * implementation detail.
 *
 * Embedding contract (see README "Host integration checklist"):
 *   import { MastercardModule, MASTERCARD_ENTITIES } from '<this-package>';
 *   - MastercardModule.forRootAsync({ inject, useFactory }) — the only module to import;
 *   - ...MASTERCARD_ENTITIES — include in TypeOrmModule.forRoot({ entities });
 *   - the host's body limit must allow RFI upload (`POST /crossborder/rfi/documents`, a
 *     base64 file up to ~1.37MB) — raise the global json limit for that route.
 */
export { MastercardModule, MASTERCARD_ENTITIES } from './mastercard.module';
export { GatewayConfig } from './config/gateway-config';
export type { MastercardModuleOptions } from './config/gateway-config';
// Host-facing contracts: the unified gateway error format (the host can rely on it when
// handling our responses) and enums for tenant onboarding via the admin API.
export { ErrorResponseDto } from './common/dto/error-response.dto';
export { CredentialMode, TenantStatus } from './tenants/tenant.types';
