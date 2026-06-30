import { ValidationPipe } from '@nestjs/common';

/**
 * Single shared validation strategy for the gateway's controllers. Replaces the
 * two earlier ad-hoc factories (`strictDtoPipe` / `mcPassthroughPipe`) with ONE
 * source of truth and two named presets, applied per-route via `@UsePipes`.
 *
 * Per-route (NOT a global / `APP_PIPE` pipe) on purpose: the module is
 * embeddable, and a global pipe — or an `APP_PIPE` registered inside a feature
 * module — applies app-wide and would leak into the host monolith's own routes
 * (or be missing / configured differently there). Each controller declares the
 * preset it needs; nothing is imposed on the host.
 */
export enum ValidationStrategy {
  /**
   * Our own boundaries (admin, oauth): we own the schema → strip unknown fields
   * (`whitelist`), reject extras (`forbidNonWhitelisted`) and transform the body
   * into the DTO instance.
   */
  Strict = 'strict',
  /**
   * Bodies forwarded to Mastercard as-is: MC owns the large, polymorphic,
   * changing schema, so we validate only the declared critical fields and:
   *   - `whitelist: false` — KEEP unknown MC fields (stripping would lose
   *     merchant data);
   *   - `forbidNonWhitelisted: false` — never reject a request over "extra" fields;
   *   - `transform: false` — do NOT coerce types (MC amounts are STRINGS;
   *     coercion to number would corrupt the payload). The handler receives the
   *     original object untouched;
   *   - `skipMissingProperties: true` — only present fields are checked.
   */
  Passthrough = 'passthrough',
}

/**
 * Stateless `ValidationPipe` instances — one shared per strategy, reused across
 * every route exactly as a single global pipe instance would be (no per-route
 * allocation). `ValidationPipe` holds its config at construction and keeps no
 * per-request state, so sharing is safe.
 */
const PIPES: Readonly<Record<ValidationStrategy, ValidationPipe>> = {
  [ValidationStrategy.Strict]: new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
  [ValidationStrategy.Passthrough]: new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
    skipMissingProperties: true,
  }),
};

/**
 * Resolve the shared validation pipe for a strategy. Use at controller/route
 * level, e.g. `@UsePipes(gatewayValidationPipe(ValidationStrategy.Passthrough))`.
 */
export const gatewayValidationPipe = (
  strategy: ValidationStrategy,
): ValidationPipe => PIPES[strategy];
