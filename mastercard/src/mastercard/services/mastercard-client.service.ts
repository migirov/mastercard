import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { NonRetryableMcError } from './mc.errors';
import { installMcInterceptors, McAxiosConfig } from './mc-interceptors';
import {
  backoffMs,
  isTransientStatus,
  maxAttemptsFor,
} from './mc-retry.policy';

export interface McRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path relative to the base URL, e.g. /send/v1/partners/.../quotes */
  readonly path: string;
  readonly body?: unknown;
  /** Additional headers. */
  readonly headers?: Record<string, string>;
}

export interface McResponse<T = unknown> {
  status: number;
  data: T;
}

/**
 * Per-request timeout to Mastercard. INVARIANT: this MUST stay well below the payment
 * idempotency lock TTL (`PaymentIdempotencyStore` LOCK_TTL_SECONDS = 120s) — a slow MC call
 * made inside that lock has to finish before the lock goes stale, otherwise another pod
 * re-claims it and re-POSTs the payment. Raising this requires raising LOCK_TTL accordingly.
 */
const MC_REQUEST_TIMEOUT_MS = 30_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Low-level Mastercard transport. Three responsibilities are split out for clarity/testing:
 *  - crypto (JWE) + OAuth1 signing → the axios interceptors (`installMcInterceptors`), so
 *    business logic passes a "clean" object and knows nothing about crypto;
 *  - the retry decision → `mc-retry.policy` (idempotent GET only);
 *  - the deterministic crypto-error taxonomy → `mc.errors`.
 * This class keeps only transport (the axios instance + keep-alive agent lifecycle) and the
 * `request()` dispatch loop. Public contract (`request`) is unchanged.
 */
@Injectable()
export class MastercardClient implements OnApplicationShutdown {
  private readonly logger = new Logger(MastercardClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly httpsAgent: https.Agent;

  constructor(config: GatewayConfig, encryption: EncryptionService) {
    const raw = config.baseUrl ?? '';
    if (!raw) {
      throw new Error('MastercardModule option "baseUrl" is not set');
    }
    this.baseUrl = raw.replace(/\/+$/, '');
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      scheduling: 'lifo',
    });
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: MC_REQUEST_TIMEOUT_MS,
      httpsAgent: this.httpsAgent,
    });
    // Encryption (JWE) + OAuth1 signing live in the axios interceptors (the request
    // interceptor encrypts then signs over the encrypted body; the response decrypts).
    installMcInterceptors(this.http, encryption, this.logger);
  }

  /** Release the keep-alive socket pool on shutdown — otherwise, on graceful
   *  shutdown / module re-initialization (tests, HMR), sockets linger and hold
   *  the event loop open longer than needed. */
  onApplicationShutdown(): void {
    this.httpsAgent.destroy();
  }

  async request<T = unknown>(
    creds: McCredentials,
    req: McRequest,
  ): Promise<McResponse<T>> {
    // Retry ONLY for idempotent GETs (balances/rates/status). POSTs are never
    // retried — risk of double-charging (payment idempotency is handled separately).
    const maxAttempts = maxAttemptsFor(req.method);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Build the config FRESH on every attempt: the request interceptor mutates
      // config.data (encrypts + serializes) and sets a fresh OAuth1 signature.
      const config: McAxiosConfig = {
        url: req.path,
        method: req.method,
        data: req.body,
        headers: { ...(req.headers ?? {}) },
        validateStatus: () => true, // we interpret the status ourselves
        mcCreds: creds,
      };
      try {
        const res = await this.http.request<T>(config);
        if (attempt < maxAttempts && isTransientStatus(res.status)) {
          await delay(backoffMs(attempt)); // transient 5xx — retry
          continue;
        }
        return { status: res.status, data: res.data };
      } catch (e) {
        // Crypto errors (request encryption / response decryption) are
        // deterministic — do NOT retry (otherwise 2 extra signed round-trips to
        // MC and a delayed 502). Only a network failure is transient.
        if (e instanceof NonRetryableMcError) throw e;
        lastErr = e; // network failure
        if (attempt < maxAttempts) {
          await delay(backoffMs(attempt));
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }
}
