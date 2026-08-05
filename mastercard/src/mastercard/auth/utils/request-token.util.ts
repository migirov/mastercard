import { randomUUID, sign as cryptoSign } from 'crypto';

/**
 * Mints Mastercard's `OAUTH2_REQUEST_TOKEN` — a self-signed JWT that goes in the
 * `Authorization` header of every Cross-Border call on the PSD2 edges. It is
 * "one-legged": there is no token endpoint to call and no DPoP proof. (Do not
 * confuse it with Mastercard's platform-wide FAPI 2.0 flow, which does use
 * `/oauth/token` + DPoP and requires ES256/PS256 keys we do not have.)
 *
 * Header  : x5t#S256, x5c (optional), kid, cty=JWS, typ=JWT, alg=RS256
 * Claims  : nbf, exp, iat, jti — no iss/sub/aud
 *
 * Verified against the live sandbox (`sandbox.api.xbs.mastercard.eu`): a bare JWT
 * in `Authorization` returns 200; omitting `x5c` also returns 200; truncating the
 * `kid` at '!' makes Mastercard answer 500, so the FULL consumer key is required.
 *
 * Hand-rolled rather than pulled from a JWT library because this is a mint-only
 * path: there is no verification code, hence no parser attack surface, and the
 * whole thing is ~40 lines pinned by golden-shape tests against Mastercard's
 * published sample. (`jsonwebtoken` would work — it does accept custom JOSE header
 * members — but it is not a declared dependency of this package and would be
 * carried for a single `crypto.sign` call.) Same convention as the other
 * hand-rolled primitives here: canonical-json, crypto and p12 utils.
 */

const b64url = (b: Buffer): string => b.toString('base64url');

/**
 * Strip PEM armour to the base64 DER that JOSE `x5c` carries (RFC 7515 §4.1.6).
 * Only the FIRST certificate is taken: `x5c` entries are per-certificate, so
 * concatenating a chain into a single entry would produce a malformed header.
 */
function pemToBase64Der(pem: string): string {
  const first =
    /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(pem);
  return (first?.[1] ?? '').replace(/\s+/g, '');
}

export interface RequestTokenInput {
  /** Full consumer key from Mastercard Developers, including the part after '!'. */
  readonly consumerKey: string;
  /** Private signing key (PEM) from the project .p12. */
  readonly signingKeyPem: string;
  /** base64url(SHA-256(DER)) of the signing certificate — the JOSE `x5t#S256`. */
  readonly certThumbprintS256?: string;
  /** Signing certificate (PEM). When given, its DER is sent as `x5c`. */
  readonly certPem?: string;
  /** Lifetime in seconds. */
  readonly ttlSeconds?: number;
  /** Issue time override in epoch seconds (tests). */
  readonly nowSeconds?: number;
}

/**
 * Token lifetime. Deliberately far below Mastercard's 900s sample: the token is
 * bound to nothing — no audience, no URL, no method, no body hash — and Mastercard
 * accepts a replay of it, so anything that captures one outbound `Authorization`
 * header holds a credential able to submit payments as us until it expires. We
 * mint per request anyway, so a long window buys nothing. 120s still leaves a 4x
 * margin over the 30s per-request timeout, so a token cannot expire in flight.
 */
export const REQUEST_TOKEN_TTL_SECONDS = 120;

/**
 * Backdate `nbf`/`iat` to absorb clock skew against Mastercard's validator. Without
 * it, a pod running even slightly fast mints tokens that are "not yet valid",
 * which surfaces as an opaque 502 on every single call with nothing in the logs
 * pointing at the clock.
 */
const CLOCK_SKEW_SECONDS = 60;

export async function mintRequestToken(
  input: RequestTokenInput,
): Promise<string> {
  if (!input.consumerKey) {
    throw new Error('request token: consumerKey is required (JOSE kid)');
  }
  if (!input.certThumbprintS256) {
    throw new Error(
      'request token: certThumbprintS256 is required (JOSE x5t#S256) — the ' +
        'signing .p12 must carry its certificate',
    );
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header: Record<string, unknown> = {
    'x5t#S256': input.certThumbprintS256,
    ...(input.certPem ? { x5c: [pemToBase64Der(input.certPem)] } : {}),
    kid: input.consumerKey,
    cty: 'JWS',
    typ: 'JWT',
    alg: 'RS256',
  };
  const claims = {
    nbf: now - CLOCK_SKEW_SECONDS,
    exp: now + (input.ttlSeconds ?? REQUEST_TOKEN_TTL_SECONDS),
    iat: now - CLOCK_SKEW_SECONDS,
    jti: randomUUID().replace(/-/g, ''),
  };

  const signingInput =
    `${b64url(Buffer.from(JSON.stringify(header)))}.` +
    `${b64url(Buffer.from(JSON.stringify(claims)))}`;

  // Callback form: an RSA-2048 signature costs ~3ms, and the synchronous API would
  // spend all of it ON the event loop. This module is embedded in a foreign
  // monolith, so that stall would add head-of-line latency to unrelated requests.
  const signature = await new Promise<Buffer>((resolve, reject) => {
    cryptoSign(
      'RSA-SHA256',
      Buffer.from(signingInput),
      input.signingKeyPem,
      (err, sig) => (err ? reject(err) : resolve(sig)),
    );
  });

  return `${signingInput}.${b64url(signature)}`;
}
