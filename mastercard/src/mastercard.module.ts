import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BoundedThrottlerStorage } from './common/throttler/bounded-throttler.storage';
import {
  GatewayConfig,
  MastercardModuleOptions,
} from './config/gateway-config';
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './mastercard.module-definition';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenants/tenant.module';
import { SecretsModule } from './secrets/secrets.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MastercardClientModule } from './mastercard/mastercard-client.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CrossBorderModule } from './crossborder/crossborder.module';
import { WebhooksModule } from './webhooks/webhooks.module';

// The entity list — single source in mastercard.entities.ts. Re-exported so the
// module's public API (host: `import { MASTERCARD_ENTITIES }`) stays stable.
export { MASTERCARD_ENTITIES } from './mastercard.entities';

/**
 * Umbrella module for the Mastercard Cross-Border integration — the ONLY module the
 * host application imports (the `b24club-api` monolith or the dev harness):
 *
 *   imports: [ MastercardModule.forRootAsync({ inject: [...], useFactory: ... }) ]
 *
 * Internally it assembles all sub-modules (private implementation details). It
 * deliberately does NOT stand up the DB (the host provides the TypeORM connection via
 * its own `forRoot`) and does NOT install a global `ValidationPipe`/`Logger`/helmet/
 * body-limit — the host application owns those. The per-pod rate-limit
 * (`ThrottlerModule`) is kept INSIDE the module so protection doesn't depend on the
 * infrastructure (ingress/proxy).
 *
 * Health probes (`/health`, `/ready`) are NOT part of the umbrella module: they're a
 * global app-level root route, and the `b24club-api` monolith already has its own probes
 * — a built-in root controller would collide with them. `HealthController` lives in the
 * dev harness (`AppModule`); in the monolith the host handles liveness/readiness (our
 * entities are already in its DataSource — readiness covers our DB too).
 *
 * Config arrives via `forRootAsync` and is distributed to sub-services through the global
 * `GatewayConfig` (services don't read `process.env`).
 *
 * Host integration is an EXPLICIT contract — the module does NOT introspect the host
 * at runtime to warn about misconfiguration. What's required is stated where it's
 * enforced or consumed:
 *   - required config → typed `MastercardModuleOptions`, fail-fast in `GatewayConfig`
 *     (throws at startup on a missing required option / weak prod secret);
 *   - the TypeORM connection must include `MASTERCARD_ENTITIES` (the host spreads the
 *     exported list, or `autoLoadEntities: true`) — a missing entity throws
 *     `EntityMetadataNotFoundError` on first use, not silently;
 *   - host-provided wiring that can't be expressed in code (shutdown hooks, the RFI
 *     route body-parser, `webhookToken` for inbound webhooks) → the README
 *     "Host integration checklist".
 * Payment idempotency and webhook dedup live on Postgres (`payment_idempotency` /
 * `tx_status`); there is no separate KV layer (or its cron cleanup) anymore.
 */
@Module({
  imports: [
    // Per-pod rate-limit as standalone protection (not delegated to the ingress).
    // The named set 'default' (120/min) is referenced by name from the per-route
    // override `@Throttle({ default: { limit: 10, ... } })` on /oauth/token.
    // Multiple simultaneous windows (short+long) aren't needed → a single set.
    //
    // A BOUNDED storage (LRU cap, no timers) replaces the library default: some trackers key
    // on unauthenticated, caller-chosen values (the OAuth client_id), and the default storage
    // never evicts keys and drains its per-hit timers in O(n) — an attacker rotating client_id
    // would grow memory without bound and pin a core. See BoundedThrottlerStorage.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      storage: new BoundedThrottlerStorage(),
    }),
    AuditModule,
    TenantModule,
    SecretsModule,
    CredentialsModule,
    MastercardClientModule,
    AuthModule,
    AdminModule,
    CrossBorderModule,
    WebhooksModule,
  ],
  providers: [
    {
      provide: GatewayConfig,
      useFactory: (opts: MastercardModuleOptions) => new GatewayConfig(opts),
      inject: [MODULE_OPTIONS_TOKEN],
    },
  ],
  exports: [GatewayConfig],
})
export class MastercardModule extends ConfigurableModuleClass {}
