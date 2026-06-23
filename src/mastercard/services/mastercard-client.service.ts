import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import * as https from 'https';
// import = require: typed (see types/mastercard.d.ts) but identical at runtime.
// require is needed because getAuthorizationHeader is called as a module method (needs this-binding).
import oauth = require('mastercard-oauth1-signer');
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';

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

/** Transient MC statuses for which retrying an idempotent GET makes sense. */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/**
 * Base class for DETERMINISTIC crypto-pipeline errors (request encryption /
 * response decryption). The retry loop does NOT retry these: a repeat yields the
 * same result plus extra signed round-trips to MC — turn them straight into a 502.
 */
class NonRetryableMcError extends Error {}
/** Request encryption/preparation error (e.g. per-tenant fail-loud guard). */
class RequestEncryptError extends NonRetryableMcError {}
/** MC response decryption error (in the response interceptor). */
class ResponseDecryptError extends NonRetryableMcError {}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-request data for the interceptors (current tenant's creds). */
interface McAxiosConfig extends AxiosRequestConfig {
  mcCreds?: McCredentials;
}

/**
 * Low-level Mastercard client. Encryption (JWE) and OAuth1 signing are moved into
 * axios interceptors — business logic passes a "clean" object and knows nothing
 * about crypto.
 *
 * The order in the request interceptor is strict: encrypt the body first, THEN
 * sign (the signature is computed over the already-encrypted body). The response
 * interceptor decrypts the response. Encryption is handled by a separate
 * `EncryptionService` (toggled per environment); when off it is passthrough.
 */
@Injectable()
export class MastercardClient implements OnApplicationShutdown {
  private readonly logger = new Logger(MastercardClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly httpsAgent: https.Agent;

  constructor(
    config: GatewayConfig,
    private readonly encryption: EncryptionService,
  ) {
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
      timeout: 30_000,
      httpsAgent: this.httpsAgent,
    });
    this.installInterceptors();
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
    const maxAttempts = req.method === 'GET' ? 3 : 1;

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
        if (
          attempt < maxAttempts &&
          TRANSIENT_STATUSES.has(res.status) // transient 5xx — retry
        ) {
          await delay(attempt * 200);
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
          await delay(attempt * 200);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  /** Encryption + signing (request) and decryption (response). */
  private installInterceptors(): void {
    // REQUEST: 1) encrypt the body  2) sign over the encrypted body
    this.http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const creds = (config as McAxiosConfig).mcCreds;
      if (!creds) {
        throw new Error('MastercardClient: missing creds in request config');
      }

      // 1) encryption (passthrough if disabled). creds is for the per-tenant key
      // (EncryptionService is still single-key; the contract is already creds-dependent).
      let body = config.data;
      if (body != null) {
        let result: { body: unknown; encrypted: boolean };
        try {
          result = this.encryption.encryptRequest(creds, body);
        } catch (e) {
          // Deterministic encryption failure (e.g. per-tenant fail-loud guard) —
          // mark non-retryable so a GET does not retry it as a network failure.
          throw new RequestEncryptError((e as Error).message);
        }
        body = result.body;
        if (result.encrypted) config.headers.set('x-encrypted', 'true');
      }
      const payload =
        body == null
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body);
      config.data = payload;

      // 2) sign over the final (encrypted) body
      const fullUrl = new URL(
        (config.baseURL ?? '') + (config.url ?? ''),
      ).toString();
      const authHeader = oauth.getAuthorizationHeader(
        fullUrl,
        (config.method ?? 'get').toUpperCase(),
        payload,
        creds.consumerKey,
        creds.signingKeyPem,
      );
      config.headers.set('Authorization', authHeader);
      // Set Accept/Content-Type only if the caller did not — do not overwrite an
      // explicit per-request override (defaults to JSON).
      if (!config.headers.has('Accept')) {
        config.headers.set('Accept', 'application/json');
      }
      if (payload !== undefined && !config.headers.has('Content-Type')) {
        config.headers.set('Content-Type', 'application/json');
      }
      return config;
    });

    // RESPONSE: decrypt the body (passthrough if plain/disabled). creds is read
    // from the response config (for the future per-tenant decryption key).
    this.http.interceptors.response.use((response) => {
      const creds = (response.config as McAxiosConfig).mcCreds;
      // Symmetric to the request interceptor: request() always sets creds. We
      // guard for it (rather than casting `as McCredentials`, which would hide a
      // desync).
      if (!creds) {
        throw new ResponseDecryptError('missing creds in response config');
      }
      try {
        response.data = this.encryption.decryptResponse(creds, response.data);
      } catch (e) {
        this.logger.error(
          `Расшифровка ответа MC не удалась: ${(e as Error).message}`,
        );
        // Mark as ResponseDecryptError — the retry loop won't treat it as a
        // network failure; higher up (in call()) it becomes a 502.
        throw new ResponseDecryptError((e as Error).message);
      }
      return response;
    });
  }
}
