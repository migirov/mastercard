import { BadGatewayException, HttpException } from '@nestjs/common';

/**
 * An error PROPAGATED from Mastercard (or another upstream). Carries the original
 * MC response body so the exception filter nests it under the stable `upstream`
 * key, instead of replacing the whole error contract with MC's native schema
 * (`{Errors:{Error:...}}`).
 */
export class UpstreamHttpException extends HttpException {
  constructor(
    public readonly upstream: unknown,
    status: number,
  ) {
    super(
      upstream && typeof upstream === 'object'
        ? (upstream as Record<string, unknown>)
        : { message: String(upstream) },
      status,
    );
  }
}

/**
 * The upstream call did not yield a forwardable business response — we return a 502 and do
 * NOT expose MC's body (it may be HTML/auth detail). Client-facing behaviour is identical to
 * a plain `BadGatewayException`; the extra `executed` flag is for INTERNAL callers (the
 * payment idempotency store) that must know whether the mutation could have happened:
 *  - `'no'`      — MC definitively rejected before executing (401/403 auth failure) → the
 *                  payment did NOT go through, so the idempotency slot is safe to release;
 *  - `'unknown'` — timeout / 5xx / network drop → MC may have accepted it before the drop →
 *                  the slot must be HELD (fail-safe against double charges).
 */
export class UpstreamUnavailableException extends BadGatewayException {
  constructor(
    public readonly executed: 'no' | 'unknown',
    message = 'Error contacting Mastercard',
  ) {
    super(message);
  }
}
