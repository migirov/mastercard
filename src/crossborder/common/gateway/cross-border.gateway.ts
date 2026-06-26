import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { stripCrlf } from '../../../common/utils/sanitize.util';
import { UpstreamHttpException } from '../../../common/utils/upstream.exception';
import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  McResponse,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { effectiveStatus, isActive } from '../../../tenants/tenant.types';

/** Business/client Mastercard statuses that are meaningful to forward to the merchant. */
const FORWARDABLE_STATUSES = new Set([400, 404, 409, 422, 429]);

/**
 * Shared Cross-Border engine: the per-area services (accounts/quotes/payments/…)
 * build an McRequest and dispatch it through here. One place for tenant gating,
 * credential resolution, the MC call + response unwrapping, and the URL/header
 * helpers used while building requests. Split out of the former monolithic
 * CrossBorderService.
 */
@Injectable()
export class CrossBorderGateway {
  private readonly logger = new Logger(CrossBorderGateway.name);

  constructor(
    private readonly registry: TenantRegistry,
    private readonly credentials: CredentialsService,
    private readonly client: MastercardClient,
  ) {}

  /**
   * Single operation runner: gating (resolveActive) → build the McRequest from
   * the resolved creds → call MC and unwrap the response (call). Public methods of
   * area services become one line; all the repeated plumbing (resolve + dispatch)
   * lives here. `build` receives the creds because the path often depends on
   * partner(creds). The header strategy is chosen explicitly by the area service:
   * `mcRefHeaders(c)` for validation/guide, `catalogHeaders(c)` for cash-pickup,
   * or no headers.
   */
  async run(
    tenantId: string,
    ctx: string,
    build: (creds: McCredentials) => McRequest,
  ): Promise<unknown> {
    const creds = await this.resolveActive(tenantId);
    return this.call(creds, build(creds), ctx);
  }

  /**
   * Resolves the merchant's credentials after first checking that it is ACTIVE.
   * Gating: transactions are forbidden until there is dual approval.
   */
  async resolveActive(tenantId: string): Promise<McCredentials> {
    const tenant = await this.registry.get(tenantId);
    if (!isActive(tenant)) {
      throw new ForbiddenException(
        `Tenant '${tenantId}' is not active (status ${effectiveStatus(tenant)})`,
      );
    }
    return this.credentials.resolve(tenant);
  }

  /**
   * Calls Mastercard and unwraps the response:
   *   2xx                       → data;
   *   business 4xx (400/404/...) → forward the status and body to the merchant;
   *   401/403/5xx/other         → 502, body is not exposed (may be HTML with
   *                               internal links), details go to the log;
   *   network error             → 502.
   */
  // Returns `unknown` deliberately: responses are opaque passthroughs of Mastercard's
  // own JSON schema (which we don't own) — typing them would be fiction. Callers forward
  // the value straight to the merchant; the one shape we DO read (status) lives on McResponse.
  async call(creds: McCredentials, req: McRequest, ctx: string): Promise<unknown> {
    let res: McResponse;
    try {
      // Response decryption happens in the MastercardClient response interceptor;
      // if it fails, the error lands here and becomes a 502 below.
      res = await this.client.request(creds, req);
    } catch (e) {
      this.logger.error(
        `Mastercard ${ctx}: call/decryption error — ${(e as Error).message}`,
      );
      throw new BadGatewayException('Error contacting Mastercard');
    }

    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    if (
      FORWARDABLE_STATUSES.has(res.status) &&
      res.data &&
      typeof res.data === 'object'
    ) {
      // The body is already decrypted by the interceptor (for plain — unchanged).
      // We forward ONLY a structured JSON response from MC (an object). A non-object
      // (HTML/string from an edge/WAF on 429, etc.) is hidden as a 502 below —
      // otherwise an HTML page with internal links could leak into `upstream`.
      // UpstreamHttpException → the filter nests MC's body under `upstream`,
      // preserving the single error contract (rather than swapping it for MC's schema).
      throw new UpstreamHttpException(res.data, res.status);
    }
    // 401/403 is a problem with OUR credentials, not the merchant's; we don't
    // mislead them or reveal that the keys are invalid. 5xx is also not exposed.
    this.logger.error(`Mastercard ${ctx}: upstream HTTP ${res.status}`);
    throw new BadGatewayException('Error contacting Mastercard');
  }

  /** partner-id safely substituted into the path (protects against path-injection in OWN). */
  partner(creds: McCredentials): string {
    return encodeURIComponent(creds.partnerId);
  }

  /**
   * Extra headers that MC requires for validation/lookup services (Address /
   * Account / Bank): X-Mc-Correlation-Id — a unique per-request trace;
   * Partner-Ref-Id — the "reference ID of the business partner". We use the RAW
   * partnerId (NOT partner()=encodeURIComponent — that is a URL-PATH encoder; the
   * header needs the raw value, otherwise a partnerId with `+`/`&`/`=` would be
   * distorted), but via stripCrlf. Partner-Ref-Id carries the partner identifier, so we
   * send the tenant's partnerId.
   */
  mcRefHeaders(creds: McCredentials): Record<string, string> {
    return {
      'X-Mc-Correlation-Id': randomUUID(),
      'Partner-Ref-Id': stripCrlf(creds.partnerId),
    };
  }

  /** Cash Pickup catalog headers: partner-id in the HEADER (raw, anti-CRLF). */
  catalogHeaders(creds: McCredentials): Record<string, string> {
    return { 'partner-id': stripCrlf(creds.partnerId) };
  }

  /**
   * Query string from the given parameters: only non-empty ones, values are
   * URL-encoded (anti query-injection — the values go into the URL of the request
   * to MC, which is then signed with OAuth1). Returns `?k=v&...` or an empty
   * string. We take only non-empty STRINGS (values from `?x[]=` and the like are
   * discarded); the keys are set by code.
   */
  qs<T extends Partial<Record<keyof T, string | undefined>>>(params: T): string {
    const pairs = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
  }
}
