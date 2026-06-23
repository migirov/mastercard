import { HttpException } from '@nestjs/common';

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
