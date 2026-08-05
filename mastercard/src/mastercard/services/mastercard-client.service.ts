import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { MIN_TLS_VERSION } from '../../common/utils/tls';
import { MC_AUTH_STRATEGY, McAuthStrategy } from '../auth/mc-auth.types';
import { McAgentProvider } from './mc-agent.provider';
import { asTlsHandshakeError, NonRetryableMcError } from './mc.errors';
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
 *  - crypto (JWE) + authentication (via the injected McAuthStrategy) → the axios
 *    interceptors (`installMcInterceptors`), so
 *    business logic passes a "clean" object and knows nothing about crypto;
 *  - the retry decision → `mc-retry.policy` (idempotent GET only);
 *  - the deterministic crypto-error taxonomy → `mc.errors`.
 * This class keeps only transport (the axios instance + keep-alive agent lifecycle) and the
 * `request()` dispatch loop. Public contract (`request`) is unchanged.
 */
@Injectable()
export class MastercardClient implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(MastercardClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly httpsAgent: https.Agent;
  private readonly authMode: string;

  constructor(
    config: GatewayConfig,
    encryption: EncryptionService,
    @Inject(MC_AUTH_STRATEGY) auth: McAuthStrategy,
    private readonly agents: McAgentProvider,
  ) {
    const raw = config.baseUrl ?? '';
    if (!raw) {
      throw new Error('MastercardModule option "baseUrl" is not set');
    }
    this.baseUrl = raw.replace(/\/+$/, '');
    // Instance default. The real per-request agent comes from McAgentProvider (it
    // carries the client certificate and may differ per tenant); this one only
    // guarantees the TLS floor for any direct use of `this.http`.
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      scheduling: 'lifo',
      // Pin the TLS floor rather than inheriting it. Node's own default is already TLSv1.2,
      // so this changes nothing at runtime today — but the default is process-global and the
      // HOST owns the process: `--tls-min-v1.0`/`--tls-min-v1.1` in NODE_OPTIONS, or a call to
      // `tls.DEFAULT_MIN_VERSION`, would silently drop every Mastercard connection to a
      // deprecated protocol. This module is embedded in a foreign monolith and cannot police
      // the host's flags, so it states its own floor per-agent, where the host cannot reach it.
      // Shared with the inbound listener via MIN_TLS_VERSION — see that file for the full
      // rationale and for why this is our baseline rather than a quoted MC requirement.
      minVersion: MIN_TLS_VERSION,
    });
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: MC_REQUEST_TIMEOUT_MS,
      httpsAgent: this.httpsAgent,
    });
    // Encryption (JWE) + authentication live in the axios interceptors (the request
    // interceptor encrypts then authenticates over the encrypted body; the response
    // decrypts). The auth scheme itself is injected — see McAuthStrategy.
    installMcInterceptors(this.http, encryption, auth, this.logger);
    this.authMode = auth.mode;
  }

  /** Hostname of the configured Mastercard endpoint (e.g. `api.xbs.mastercard.eu`). */
  get upstreamHost(): string {
    return new URL(this.baseUrl).hostname;
  }

  /** Announce the active target once dependencies are wired — a side-effect-free
   *  constructor is a Nest convention here (same as EncryptionService/AuditService),
   *  and in an embedded host a constructor-time log bypasses its logger setup. */
  onModuleInit(): void {
    this.logger.log(
      `Mastercard transport ready: ${this.baseUrl} (auth: ${this.authMode})`,
    );
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
      // Hard TOTAL-duration bound per attempt. The axios `timeout` above is a socket-INACTIVITY
      // timer armed on socket ASSIGNMENT (verified against axios 1.6.0 http adapter): with
      // maxSockets:50 a queued request runs untimed, and once armed a trickling response resets
      // it — neither bounds wall-clock time. This call runs inside the payment idempotency lock
      // (LOCK_TTL 120s) and MUST finish well before it, or another pod re-claims the slot and
      // re-POSTs the payment, so we abort at MC_REQUEST_TIMEOUT_MS regardless.
      // Resolve the outbound TLS identity BEFORE arming the timer below: this can
      // refuse (an OWN tenant with no client certificate on an endpoint that requires
      // one), and a throw between `setTimeout` and the `try` would leave the timer
      // armed with nothing to clear it.
      const httpsAgent = this.agents.agentFor(creds);
      const abort = new AbortController();
      const killer = setTimeout(() => abort.abort(), MC_REQUEST_TIMEOUT_MS);
      // Don't let the abort timer hold the event loop open if the process is otherwise idle.
      killer.unref();
      // Build the config FRESH on every attempt: the request interceptor mutates
      // config.data (encrypts + serializes) and sets fresh auth headers.
      const config: McAxiosConfig = {
        url: req.path,
        method: req.method,
        data: req.body,
        headers: { ...(req.headers ?? {}) },
        validateStatus: () => true, // we interpret the status ourselves
        mcCreds: creds,
        signal: abort.signal,
        // Per-request agent: carries the outbound client certificate, and picks the
        // tenant's own one when it has one. axios merges a request-level httpsAgent
        // over the instance default (mergeConfig `defaultToConfig2`).
        httpsAgent,
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
        // A failed TLS handshake is a configuration fact, not a blip: retrying it
        // costs two more round-trips and still ends in a 502 — one that says nothing
        // about WHICH certificate is at fault. Naming it is the difference between a
        // one-line fix and an outage spent guessing.
        //
        // Whether the payment idempotency slot is released is decided per error, NOT
        // by the fact that TLS failed: under TLS 1.3 our request is flushed before the
        // server has validated our certificate, so a received alert arrives with the
        // body already on the wire. See TlsSendEvidence for the measurements.
        const tls = asTlsHandshakeError(e, this.upstreamHost);
        if (tls) throw tls;
        lastErr = e; // network failure (an abort at MC_REQUEST_TIMEOUT_MS lands here too)
        if (attempt < maxAttempts) {
          await delay(backoffMs(attempt));
          continue;
        }
        throw e;
      } finally {
        clearTimeout(killer);
      }
    }
    throw lastErr;
  }
}
