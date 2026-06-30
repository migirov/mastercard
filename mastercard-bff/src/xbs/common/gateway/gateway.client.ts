import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { McConfig } from '../../../config/mc-config';

/** A method + path (+ optional body/query) for a gateway call. */
export interface GatewayCall {
  readonly method: 'GET' | 'POST';
  /** Path under the gateway, e.g. `/crossborder/balances`. */
  readonly path: string;
  readonly body?: unknown;
  readonly query?: Record<string, string | undefined>;
}

/**
 * Thin axios client to the sibling Mastercard gateway (`mastercard` service). Used by
 * the XBS area services only when a capability is in `live` mode. Internal
 * service-to-service auth: `X-Internal-Token` + `X-Tenant-Id` (the gateway resolves
 * the tenant's Mastercard credentials from the id).
 *
 * `call` NEVER throws: on any network error / non-2xx it returns `{ ok: false }` so
 * the caller can gracefully fall back to demo synthesis (the gateway returns opaque
 * Mastercard JSON and sandbox often rejects best-effort bodies — that's expected).
 */
export type GatewayResult =
  { ok: true; status: number; data: unknown } | { ok: false };

@Injectable()
export class GatewayClient {
  private readonly logger = new Logger(GatewayClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly cfg: McConfig) {
    const { baseUrl, internalToken, tenantId } = this.cfg.gateway;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 15_000,
      headers: {
        'X-Internal-Token': internalToken,
        'X-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
      },
      // Never throw on a non-2xx — we inspect the status ourselves and fall back.
      validateStatus: () => true,
    });
  }

  /**
   * Perform a gateway call. Returns `{ ok: true, data }` only on a 2xx; any other
   * status, a network failure, or a thrown error → `{ ok: false }` (logged at WARN),
   * so the area service falls back to demo synthesis.
   */
  async call(call: GatewayCall): Promise<GatewayResult> {
    const config: AxiosRequestConfig = {
      method: call.method,
      url: call.path,
      params: call.query
        ? Object.fromEntries(
            Object.entries(call.query).filter(([, v]) => v !== undefined),
          )
        : undefined,
      data: call.body,
    };
    try {
      const res = await this.http.request(config);
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.status, data: res.data };
      }
      this.logger.warn(
        `gateway ${call.method} ${call.path} → ${res.status} (falling back to demo)`,
      );
      return { ok: false };
    } catch (err) {
      this.logger.warn(
        `gateway ${call.method} ${call.path} failed: ${
          (err as Error).message
        } (falling back to demo)`,
      );
      return { ok: false };
    }
  }
}
