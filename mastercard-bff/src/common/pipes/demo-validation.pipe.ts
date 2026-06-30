import { ValidationPipe } from '@nestjs/common';

/**
 * Shared validation strategy for this BFF's `/xbs` and `/features` request DTOs. Mirrors the
 * gateway's `gateway-validation.pipe.ts` (single source of truth + a named preset, applied
 * per-route via `@UsePipes`). This BFF OWNS every one of its request contracts, so it uses the
 * strict preset everywhere: strip unknown fields (`whitelist`), reject extras
 * (`forbidNonWhitelisted`) and transform the body/query into the DTO instance.
 *
 * Per-route (not a global `APP_PIPE`) on purpose, exactly as the gateway does it (team-lead
 * issue #12) — a global pipe would leak into a host monolith if this were ever embedded.
 */
export enum ValidationStrategy {
  Strict = 'strict',
}

/**
 * Stateless `ValidationPipe` instance — one shared per strategy, reused across every
 * route (no per-route allocation). `ValidationPipe` holds its config at construction
 * and keeps no per-request state, so sharing is safe.
 */
const PIPES: Readonly<Record<ValidationStrategy, ValidationPipe>> = {
  [ValidationStrategy.Strict]: new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
};

/**
 * Resolve the shared validation pipe for a strategy. Use at controller/route level,
 * e.g. `@UsePipes(demoValidationPipe(ValidationStrategy.Strict))`.
 */
export const demoValidationPipe = (
  strategy: ValidationStrategy,
): ValidationPipe => PIPES[strategy];
