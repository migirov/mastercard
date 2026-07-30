import { createHmac } from 'crypto';
import { safeEqual } from './crypto.util';

/**
 * The access-gate proof: what a caller presents to show it passed the password gate.
 *
 * Duplicated verbatim into `mastercard-bff/src/common/utils/gate-proof.util.ts`. The duplication
 * is deliberate and unavoidable, for the same reason `crypto.util.ts` carries the same note: the
 * two BFFs are separate projects and each Dockerfile only copies its own build context, so there
 * is nothing to import. Keep the two in sync by hand — `gate-proof.util.spec.ts` in each service
 * asserts a proof signed by one verifies under the other, which is the test that catches drift.
 *
 * app-bff signs AND verifies (it owns `POST /gate/verify`). mastercard-bff only ever verifies —
 * it never mints a proof, so `signGateProof` is unused there but kept so the files stay identical.
 *
 * FORMAT: `v1.<expiryEpochSeconds>.<base64url HMAC-SHA256 over "v1.<expiryEpochSeconds}">`
 *
 * Stateless on purpose: there is no session store, so nothing to scale, evict, or share between
 * the two containers — they only need the same secret. No jti/nonce either: revocation would
 * require shared state across both services, and a single-tenant demo has nothing to revoke.
 *
 * The version prefix is INSIDE the signed payload, not merely concatenated onto it. That is what
 * stops a future `v2` from being downgraded to `v1` by an attacker rewriting the prefix.
 *
 * The expiry is readable by the client, and that is a feature: the SPA can decide whether to show
 * the gate screen on page load with no round-trip, while the server remains the only thing that
 * decides whether a request is actually served.
 */
const VERSION = 'v1';

/** HMAC-SHA256 of `payload` under `secret`, base64url so it is safe in a header. */
function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export interface GateProof {
  readonly proof: string;
  /** Epoch MILLISECONDS, for a JSON response the browser can use directly. */
  readonly expiresAt: number;
}

/**
 * Mint a proof valid for `ttlSeconds`.
 *
 * Callers must have checked the password first — this function does not know about passwords, and
 * signing is unconditional.
 */
export function signGateProof(
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): GateProof {
  const expirySeconds = Math.floor(now / 1000) + ttlSeconds;
  const payload = `${VERSION}.${expirySeconds}`;
  return {
    proof: `${payload}.${sign(secret, payload)}`,
    expiresAt: expirySeconds * 1000,
  };
}

/**
 * `true` only for a proof this deployment's secret actually signed, and which has not expired.
 *
 * Fails closed on EVERY other input, and never throws — a malformed header must produce a 401,
 * never a 500. That matters because the value is fully attacker-controlled: it arrives in a
 * request header.
 *
 * An unconfigured secret ('') denies everything, the same posture `matchSharedToken` takes for
 * `DEMO_API_TOKEN`. So a deployment that forgets `DEMO_GATE_SECRET` serves 401s rather than
 * quietly accepting forged proofs.
 *
 * The signature is checked BEFORE the expiry so an attacker cannot use the response to probe
 * whether an arbitrary expiry lies in the future without holding a valid signature.
 */
export function verifyGateProof(
  proof: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!secret || !proof) return false;

  const parts = proof.split('.');
  if (parts.length !== 3) return false;
  const [version, expiry, signature] = parts;

  if (version !== VERSION) return false;
  // Digits only: keeps `Number()` away from '0x10', ' 12', '1e9' and the empty string, any of
  // which would otherwise coerce to something surprising.
  if (!/^[0-9]+$/.test(expiry)) return false;

  if (!safeEqual(signature, sign(secret, `${version}.${expiry}`))) return false;

  return Number(expiry) * 1000 > now;
}
