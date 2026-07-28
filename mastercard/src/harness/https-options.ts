import { readFileSync } from 'node:fs';
import { MIN_TLS_VERSION } from '../common/utils/tls';

export interface HarnessHttpsOptions {
  key: Buffer;
  cert: Buffer;
  ca?: Buffer;
  requestCert: boolean;
  rejectUnauthorized: boolean;
  minVersion: typeof MIN_TLS_VERSION;
}

/**
 * Server TLS for the standalone bootstrap, gated on TLS_KEY_PATH/TLS_CERT_PATH.
 *
 * `requestCert` makes the app ASK for a client certificate so `WebhookAuthGuard` can validate
 * Mastercard's cert IN-APP; `rejectUnauthorized: false` keeps non-webhook routes (partners,
 * which present no client cert) working — the guard enforces the certificate only on the
 * webhook route. Mastercard authenticates push notifications by client certificate alone, so
 * TLS must be terminated here and the ingress run as an L4 passthrough.
 *
 * Despite living under `harness/`, this is not dev-only: the shipped image starts
 * `dist/harness/main.js`, so when we host the gateway ourselves this is the production
 * listener Mastercard terminates against. (An embedding host that supplies its own bootstrap
 * replicates these options there.)
 *
 * Extracted from `main.ts` so it is reachable from tests — `main.ts` calls `bootstrap()` at
 * module scope and cannot be imported without starting the application.
 */
export function httpsOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): HarnessHttpsOptions | undefined {
  const key = env.TLS_KEY_PATH;
  const cert = env.TLS_CERT_PATH;
  if (!key || !cert) return undefined;
  const ca = env.TLS_CLIENT_CA_PATH;
  return {
    key: readFileSync(key),
    cert: readFileSync(cert),
    ca: ca ? readFileSync(ca) : undefined,
    requestCert: true,
    rejectUnauthorized: false,
    minVersion: MIN_TLS_VERSION,
  };
}
