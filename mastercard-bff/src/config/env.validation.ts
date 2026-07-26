import { z } from 'zod';

/**
 * Environment-variable schema for the mastercard-bff. Validated ONCE at startup
 * (ConfigModule `validate`), fail-fast — instead of scattered lazy `throw`s on
 * first access. Mirrors the gateway's `config/env.validation.ts` convention.
 *
 * Values are kept as strings (no coercion): the typed `McConfig` reads them via
 * `ConfigService.get<string>(...)` and converts explicitly (`Number(...)`, `=== 'live'`).
 * All vars are optional with defaults in `McConfig` — this BFF is stateless (no DB) and
 * runs zero-config against the sibling gateway.
 */
// `live` | `demo`, optional. An EMPTY string is treated as "unset" (compose/.env commonly
// write `XBS_X_MODE=`); without this an empty value would fail the enum and abort startup,
// even though `McConfig.mode()` already tolerates anything non-`live`/`demo` as the default.
const xbsMode = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.enum(['live', 'demo']).optional(),
);

// Same idiom as `xbsMode`: an EMPTY string means "unset". compose and .env files routinely
// write `FOO=` for a value they mean to leave blank; without this the var would arrive as ''
// and read as "configured with an empty secret", which is exactly the case that must fail closed.
const optionalNonEmpty = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().optional(),
);

const EnvSchema = z.object({
  // --- runtime ---
  NODE_ENV: z.string().optional(),
  // positive-integer string (the HTTP port; parsed later via Number()).
  PORT: z
    .string()
    .regex(/^[1-9][0-9]*$/, 'must be a positive integer')
    .optional(),

  // --- API authentication ---
  // Shared bearer token every caller must present (see DemoAuthGuard). Optional HERE, on
  // purpose: an absent token must not abort startup silently at the schema layer. It is
  // handled where the consequence can be stated — main.ts throws in production and warns
  // loudly otherwise, and the guard denies every request either way.
  DEMO_API_TOKEN: optionalNonEmpty,
  // Comma-separated browser origins allowed to call this API cross-origin. Unset → the
  // localhost dev defaults in McConfig. Only relevant to `npm run dev`: in the compose
  // stack the SPA reaches this service same-origin through nginx.
  CORS_ORIGINS: optionalNonEmpty,

  // --- cross-border gateway (the sibling `mastercard` service) ---
  GATEWAY_URL: z.string().optional(),
  GATEWAY_INTERNAL_TOKEN: z.string().optional(),
  GATEWAY_TENANT_ID: z.string().optional(),

  // --- per-capability live|demo switch (validate the enum if present and non-empty) ---
  XBS_QUOTE_MODE: xbsMode,
  XBS_VALIDATION_MODE: xbsMode,
  XBS_BALANCES_MODE: xbsMode,
  XBS_PAYMENT_MODE: xbsMode,
  XBS_STATUS_MODE: xbsMode,

  // --- per-feature live|demo switch (the "Features" pages) ---
  XBS_BANK_LOOKUP_MODE: xbsMode,
  XBS_IBAN_MODE: xbsMode,
  XBS_CASH_PICKUP_MODE: xbsMode,
  XBS_RATES_MODE: xbsMode,
  XBS_ENDPOINT_GUIDE_MODE: xbsMode,
  XBS_QUOTE_LIFECYCLE_MODE: xbsMode,
  XBS_PAYMENT_TRACKER_MODE: xbsMode,
  XBS_RFI_MODE: xbsMode,
});

/** ConfigModule `validate`: throws with a readable message if .env is invalid. */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid .env configuration: ${details}`);
  }
  // Return the ORIGINAL config (not the parsed object): Zod strips keys it does
  // not declare, and we must keep undeclared vars available in ConfigService.
  // Unknown keys are ignored by the schema, not rejected, so they pass untouched.
  return config;
}
