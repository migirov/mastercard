import { Logger } from '@nestjs/common';
import {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
// import = require: typed (see types/mastercard.d.ts) but identical at runtime. require is
// needed because getAuthorizationHeader is called as a module method (needs this-binding).
import oauth = require('mastercard-oauth1-signer');
import { McCredentials } from '../../credentials/credentials.types';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { RequestEncryptError, ResponseDecryptError } from './mc.errors';

/** Per-request data carried on the axios config for the interceptors (current tenant's creds). */
export interface McAxiosConfig extends AxiosRequestConfig {
  mcCreds?: McCredentials;
}

/**
 * Installs the Mastercard request/response axios interceptors on `http`. Extracted from
 * MastercardClient so transport, retry and crypto/signing orchestration are separate
 * responsibilities (the EncryptionService itself is kept — this module only orchestrates it).
 *
 *  - REQUEST: 1) encrypt the body (JWE; passthrough when disabled) 2) OAuth1-sign over the
 *    FINAL (encrypted) body. The order is strict and lives in ONE interceptor (so it does not
 *    depend on axios's reverse interceptor-execution order).
 *  - RESPONSE: decrypt the body (passthrough when plain/disabled).
 */
export function installMcInterceptors(
  http: AxiosInstance,
  encryption: EncryptionService,
  logger: Logger,
): void {
  // REQUEST: 1) encrypt the body  2) sign over the encrypted body
  http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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
