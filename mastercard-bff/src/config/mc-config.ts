import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The five cross-border capabilities switched independently between live and demo. */
export type XbsCapability =
  'quote' | 'validation' | 'balances' | 'payment' | 'status';

/**
 * The eight "Features" capabilities — the gateway APIs the original frontend never
 * surfaced, each switched independently between live and demo. Live-by-default ones
 * (bankLookup/ibanGen/cashPickup) return REAL Mastercard sandbox data today; the rest
 * default to demo (sandbox-limited) until Mastercard opens them, then flip via env.
 */
export type FeatureCapability =
  | 'bankLookup'
  | 'ibanGen'
  | 'cashPickup'
  | 'rates'
  | 'endpointGuide'
  | 'quoteLifecycle'
  | 'paymentTracker'
  | 'rfi';

/** Per-capability mode: `live` proxies to the gateway, `demo` synthesizes. */
export type XbsMode = 'live' | 'demo';

export interface GatewayConnConfig {
  readonly baseUrl: string;
  readonly internalToken: string;
  readonly tenantId: string;
}

/**
 * Typed access to the mastercard-bff configuration: a single `@Injectable` wrapper over
 * `ConfigService` (Zod-validated env) with getters — so NO service reads `process.env`
 * directly. This BFF is STATELESS (no DB): it only proxies cross-border calls to the
 * sibling `mastercard` gateway (live mode) or synthesizes them (demo mode). Defaults here.
 */
@Injectable()
export class McConfig {
  constructor(private readonly config: ConfigService) {}

  /** HTTP port (browser-facing BFF). */
  get port(): number {
    return Number(this.config.get<string>('PORT')) || 4000;
  }

  get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /** How the cross-border gateway (sibling `mastercard`) is reached. */
  get gateway(): GatewayConnConfig {
    return {
      baseUrl: this.config.get<string>('GATEWAY_URL') ?? 'http://app:3000',
      internalToken: this.config.get<string>('GATEWAY_INTERNAL_TOKEN') ?? '',
      // `platform` is the baseline tenant the gateway seeds on boot (DevSeedService) and is
      // ACTIVE with the platform Mastercard credentials. (`acme` only exists after the
      // gateway's `npm run seed`, so it must NOT be the default — live calls would 404.)
      tenantId: this.config.get<string>('GATEWAY_TENANT_ID') ?? 'platform',
    };
  }

  /**
   * Per-capability live|demo mode. Defaults reflect sandbox availability: validation /
   * balances return real data on sandbox → `live`; quote returns a STUB rate (`777`),
   * and payment submit / push status need MTF/Prod → `demo` for now (flip via env once
   * Mastercard opens them).
   */
  mode(capability: XbsCapability): XbsMode {
    const env: Record<XbsCapability, string> = {
      quote: 'XBS_QUOTE_MODE',
      validation: 'XBS_VALIDATION_MODE',
      balances: 'XBS_BALANCES_MODE',
      payment: 'XBS_PAYMENT_MODE',
      status: 'XBS_STATUS_MODE',
    };
    const def: Record<XbsCapability, XbsMode> = {
      quote: 'demo', // sandbox returns a stub rate (777) → demo until MTF/Prod
      validation: 'live',
      balances: 'live',
      payment: 'demo',
      status: 'demo',
    };
    const v = this.config.get<string>(env[capability]);
    return v === 'live' || v === 'demo' ? v : def[capability];
  }

  /** All five modes as an object — surfaced by `/health` so the demo is self-documenting. */
  get modes(): Record<XbsCapability, XbsMode> {
    return {
      quote: this.mode('quote'),
      validation: this.mode('validation'),
      balances: this.mode('balances'),
      payment: this.mode('payment'),
      status: this.mode('status'),
    };
  }

  /**
   * Per-feature live|demo mode (the "Features" pages). Defaults reflect what the MC
   * sandbox actually returns: bank-lookup / IBAN-generation / cash-pickup give REAL data
   * today → `live`; carded rates, endpoint guide, quote lifecycle, payment tracking and
   * RFI are sandbox-limited → `demo` (flip via env once Mastercard enables them).
   */
  featureMode(capability: FeatureCapability): XbsMode {
    const env: Record<FeatureCapability, string> = {
      bankLookup: 'XBS_BANK_LOOKUP_MODE',
      ibanGen: 'XBS_IBAN_MODE',
      cashPickup: 'XBS_CASH_PICKUP_MODE',
      rates: 'XBS_RATES_MODE',
      endpointGuide: 'XBS_ENDPOINT_GUIDE_MODE',
      quoteLifecycle: 'XBS_QUOTE_LIFECYCLE_MODE',
      paymentTracker: 'XBS_PAYMENT_TRACKER_MODE',
      rfi: 'XBS_RFI_MODE',
    };
    const def: Record<FeatureCapability, XbsMode> = {
      bankLookup: 'live',
      ibanGen: 'live',
      cashPickup: 'live',
      rates: 'demo',
      endpointGuide: 'demo',
      quoteLifecycle: 'demo',
      paymentTracker: 'demo',
      rfi: 'demo',
    };
    const v = this.config.get<string>(env[capability]);
    return v === 'live' || v === 'demo' ? v : def[capability];
  }

  /** All eight feature modes — surfaced by `/health` alongside `modes`. */
  get featureModes(): Record<FeatureCapability, XbsMode> {
    return {
      bankLookup: this.featureMode('bankLookup'),
      ibanGen: this.featureMode('ibanGen'),
      cashPickup: this.featureMode('cashPickup'),
      rates: this.featureMode('rates'),
      endpointGuide: this.featureMode('endpointGuide'),
      quoteLifecycle: this.featureMode('quoteLifecycle'),
      paymentTracker: this.featureMode('paymentTracker'),
      rfi: this.featureMode('rfi'),
    };
  }
}
