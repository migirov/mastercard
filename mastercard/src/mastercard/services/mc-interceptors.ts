import { Logger } from '@nestjs/common';
import {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { McAuthStrategy } from '../auth/mc-auth.types';
import {
  AuthHeaderError,
  RequestEncryptError,
  ResponseDecryptError,
} from './mc.errors';

/**
 * Upper bound on how long the auth strategy may take to produce headers.
 *
 * This is not belt-and-braces: axios registers the caller's abort signal in the
 * ADAPTER, which runs after the interceptor chain, so `MastercardClient`'s 30s
 * killer does not bound a stalled interceptor. Since the whole request runs inside
 * the payment idempotency lock (LOCK_TTL 120s), an unbounded wait here could let
 * another pod re-claim the slot and re-POST the payment. Signing/minting is pure
 * CPU (~1-3ms), so this only ever fires on a genuine defect.
 */
const MC_AUTH_HEADER_BUDGET_MS = 5_000;

/**
 * Resolve the strategy's headers or fail loudly within the budget. Both the timeout
 * and any strategy error become `AuthHeaderError` (non-retryable): nothing has been
 * sent, so a repeat would fail the same way.
 */
async function withBudget(
  // A THUNK, not a promise: a strategy that is not declared `async` and throws
  // synchronously would otherwise escape the wrapper entirely (the throw would happen
  // while evaluating the argument), and the raw Error — not being a NonRetryableMcError
  // — would let the retry loop treat a signing defect as a network blip and re-send.
  produce: () => Promise<Record<string, string>>,
  mode: string,
): Promise<Record<string, string>> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      produce(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AuthHeaderError(
                `auth strategy '${mode}' did not produce headers within ${MC_AUTH_HEADER_BUDGET_MS}ms`,
              ),
            ),
          MC_AUTH_HEADER_BUDGET_MS,
        );
        timer.unref();
      }),
    ]);
  } catch (e) {
    if (e instanceof AuthHeaderError) throw e;
    // Keep the original error as `cause`: without it the only surviving stack points
    // at this wrapper, and a signing failure becomes diagnosable by message text alone.
    // `?? e` so a thrown non-Error (string, object) still says something useful
    // instead of stringifying to "undefined".
    throw new AuthHeaderError(
      `auth strategy '${mode}': ${String((e as Error)?.message ?? e)}`,
      e,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Per-request data carried on the axios config for the interceptors (current tenant's creds). */
export interface McAxiosConfig extends AxiosRequestConfig {
  mcCreds?: McCredentials;
}

/**
 * Installs the Mastercard request/response axios interceptors on `http`. Extracted from
 * MastercardClient so transport, retry and crypto/signing orchestration are separate
 * responsibilities (the EncryptionService itself is kept — this module only orchestrates it).
 *
 *  - REQUEST: 1) encrypt the body (JWE; passthrough when disabled) 2) authenticate over the
 *    FINAL (encrypted) body, via the injected `McAuthStrategy` (OAuth 1.0a signature on the
 *    `.com` endpoints, an OAuth2 request token on the PSD2 `.eu`/`.uk` edges). The order is
 *    strict and lives in ONE interceptor (so it does not depend on axios's reverse
 *    interceptor-execution order).
 *  - RESPONSE: decrypt the body (passthrough when plain/disabled).
 */
export function installMcInterceptors(
  http: AxiosInstance,
  encryption: EncryptionService,
  auth: McAuthStrategy,
  logger: Logger,
): void {
  // REQUEST: 1) encrypt the body  2) authenticate over the encrypted body.
  // Async because a strategy may need to await; axios chains the promise natively.
  http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const creds = (config as McAxiosConfig).mcCreds;
    if (!creds) {
      // RequestEncryptError, not a bare Error: this fires before the adapter runs,
      // so nothing was sent. A plain Error would be treated as a network blip —
      // retried on GET, and classified `executed:'unknown'`, which needlessly holds
      // a payment idempotency slot for a purely local defect.
      throw new RequestEncryptError(
        'MastercardClient: missing creds in request config',
      );
    }

    // 1) encryption (passthrough if disabled). creds is for the per-tenant key
    // (EncryptionService is still single-key; the contract is already creds-dependent).
    let body = config.data;
    if (body != null) {
      let result: { body: unknown; encrypted: boolean };
      try {
        result = encryption.encryptRequest(creds, body);
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

    // 2) authenticate over the final (encrypted) body
    const fullUrl = new URL(
      (config.baseURL ?? '') + (config.url ?? ''),
    ).toString();
    const headers = await withBudget(
      () =>
        auth.authHeaders(creds, {
          method: (config.method ?? 'get').toUpperCase(),
          url: fullUrl,
          payload,
        }),
      auth.mode,
    );
    for (const [name, value] of Object.entries(headers)) {
      config.headers.set(name, value);
    }
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

  // RESPONSE: decrypt the body (passthrough if plain/disabled). creds is read from the
  // response config (for the future per-tenant decryption key).
  http.interceptors.response.use((response) => {
    const creds = (response.config as McAxiosConfig).mcCreds;
    // Symmetric to the request interceptor: request() always sets creds. We guard for it
    // (rather than casting `as McCredentials`, which would hide a desync).
    if (!creds) {
      throw new ResponseDecryptError('missing creds in response config');
    }
    try {
      response.data = encryption.decryptResponse(creds, response.data);
    } catch (e) {
      logger.error(`MC response decryption failed: ${(e as Error).message}`);
      // Mark as ResponseDecryptError — the retry loop won't treat it as a network
      // failure; higher up (in CrossBorderGateway.call) it becomes a 502.
      throw new ResponseDecryptError((e as Error).message);
    }
    return response;
  });
}
