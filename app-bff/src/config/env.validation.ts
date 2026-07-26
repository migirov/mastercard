import { z } from 'zod';

/**
 * Environment-variable schema for the app-bff. Validated ONCE at startup
 * (ConfigModule `validate`), fail-fast — instead of scattered lazy `throw`s on first
 * access. Mirrors the gateway's `config/env.validation.ts` convention.
 *
 * Values are kept as strings (no coercion): the typed `AppConfig` reads them via
 * `ConfigService.get<string>(...)` and converts explicitly. All vars are optional with
 * defaults in `AppConfig` — the app-bff runs zero-config against the shared compose Postgres.
 */
// An EMPTY string is treated as "unset". compose and .env files routinely write `FOO=` for a
// value they mean to leave blank; without this the var would arrive as '' and read as
// "configured with an empty secret", which is exactly the case that must fail closed.
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
  // localhost dev defaults in AppConfig. Only relevant to `npm run dev`: in the compose
  // stack the SPA reaches this service same-origin through nginx.
  CORS_ORIGINS: optionalNonEmpty,

  // --- app data database (its OWN db `mc_demo`; never the gateway's `mc_gateway`) ---
  DEMO_DB_HOST: z.string().optional(),
  DEMO_DB_PORT: z
    .string()
    .regex(/^[1-9][0-9]*$/, 'must be a positive integer')
    .optional(),
  DEMO_DB_USER: z.string().optional(),
  DEMO_DB_PASSWORD: z.string().optional(),
  // Constrained: the name is interpolated into `CREATE DATABASE "<name>"` (identifiers can't
  // be parameterized). Trusted (operator env, not request input), but validated as defense-in-depth.
  DEMO_DB_NAME: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'must be a valid SQL identifier')
    .optional(),
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
  return config;
}
