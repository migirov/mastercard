import { z } from 'zod';

/**
 * Environment-variable schema. Validated ONCE at startup (ConfigModule
 * `validate`), fail-fast — instead of scattered lazy `throw`s on first access.
 * Conditional vars (encryption keys when MC_ENCRYPTION_ENABLED=true, etc.) stay
 * optional here and are checked at their point of use.
 *
 * Values are kept as strings (no coercion): the app reads them via
 * `ConfigService.get<string>(...)` and converts explicitly (`=== 'true'`,
 * `Number(...)`), so the schema only validates FORMAT and leaves types untouched.
 */
const EnvSchema = z.object({
  // --- always required ---
  MC_BASE_URL: z.string().min(1),
  MC_CONSUMER_KEY: z.string().min(1),
  MC_PARTNER_ID: z.string().min(1),
  MC_SIGNING_KEY_PATH: z.string().min(1),
  MC_SIGNING_KEY_PASSWORD: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  MC_JWT_SECRET: z.string().min(16),
  MC_INTERNAL_TOKEN: z.string().min(1),
  MC_ADMIN_TOKEN: z.string().min(1),

  // --- optional / defaulted (validate format only if present) ---
  MC_ENCRYPTION_ENABLED: z.enum(['true', 'false']).optional(),
  MC_SECRET_STORE: z.enum(['local', 'vault']).optional(),
  // positive-integer string (pool size; parsed later via Number()). Stricter than
  // the old @IsNumberString, which also accepted floats/signs (e.g. '-3.5') that
  // make no sense as a pool max — fail fast on those instead.
  DB_POOL_MAX: z
    .string()
    .regex(/^[1-9][0-9]*$/, 'must be a positive integer')
    .optional(),
  MC_ENCRYPTION_CERT_PATH: z.string().optional(),
  MC_ENCRYPTION_FINGERPRINT: z.string().optional(),
  MC_DECRYPTION_KEY_PATH: z.string().optional(),
  MC_WEBHOOK_TOKEN: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
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
  // not declare, and we must keep undeclared vars (NODE_ENV, PORT, PoC keys, …)
  // available in ConfigService. Unknown keys are ignored by the schema, not
  // rejected, so they pass validation untouched.
  return config;
}
