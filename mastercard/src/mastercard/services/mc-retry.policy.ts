/**
 * Retry policy for outbound Mastercard calls — extracted from MastercardClient so the
 * transport class stays focused on transport + dispatch (responsibility split, like the
 * CredentialsService/CrossBorder splits).
 *
 * Only idempotent GETs are retried (balances/rates/status); POSTs are NEVER retried (double-
 * charge risk — payment idempotency is handled separately).
 *
 * `axios-retry` was considered and REJECTED: the client sets `validateStatus: () => true` to
 * interpret every status itself (forward business 4xx to the merchant, hide 5xx as a 502), so
 * a 5xx never rejects — and axios-retry only retries REJECTED requests, so it would never see
 * the transient 5xx. Adopting it would mean dropping that deliberate design and rewriting the
 * response handling, for no gain. The hand-rolled policy below is the right fit here.
 */

/** Transient MC statuses for which retrying an idempotent GET makes sense. */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/** Linear backoff step between idempotent-GET retries: 200ms, then 400ms. */
const BACKOFF_STEP_MS = 200;

/** Max attempts for a method: an idempotent GET retries (3); everything else runs once. */
export function maxAttemptsFor(method: string): number {
  return method === 'GET' ? 3 : 1;
}

/** Whether a resolved-response status is a transient 5xx worth one more attempt. */
export function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUSES.has(status);
}

/** Linear backoff (ms) before the next attempt; `attempt` is 1-based (1→200, 2→400). */
export function backoffMs(attempt: number): number {
  return attempt * BACKOFF_STEP_MS;
}
