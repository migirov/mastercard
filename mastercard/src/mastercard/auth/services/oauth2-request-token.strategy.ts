import { Injectable } from '@nestjs/common';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McAuthMode,
  McAuthStrategy,
  McOutboundRequest,
} from '../mc-auth.types';
import { mintRequestToken } from '../utils/request-token.util';

/**
 * Mastercard `OAUTH2_REQUEST_TOKEN` authentication — required by the PSD2 edges
 * (`*.api.xbs.mastercard.eu` / `.uk`) for customers contracted with MTS EU / UK.
 *
 * A fresh self-signed JWT goes into `Authorization` on every call. Unlike OAuth 1.0a
 * the token does NOT cover the request body or URL, so it is request-independent.
 *
 * Minted per request rather than cached. A live probe confirmed Mastercard accepts
 * the same token twice, so caching would be permitted — but the signature is a few
 * milliseconds off the event loop, whereas a cache would have to reason about
 * expiry-in-flight inside the payment idempotency lock. Deleting that entire class
 * of bug is the right trade here; revisit only if profiling says otherwise.
 */
@Injectable()
export class OAuth2RequestTokenStrategy implements McAuthStrategy {
  readonly mode: McAuthMode = 'oauth2-request-token';

  async authHeaders(
    creds: McCredentials,
    _req: McOutboundRequest,
  ): Promise<Record<string, string>> {
    // Refuse here rather than passing an empty thumbprint down: the message names
    // the tenant's missing material instead of surfacing as a generic mint failure.
    // Only reachable if the .p12 carried no certificate — PLATFORM credentials are
    // additionally checked at boot (see PlatformCredentialsProvider).
    if (!creds.signingCertThumbprintS256) {
      throw new Error(
        'OAuth2 request token requires the signing certificate: the configured ' +
          '.p12 holds a private key but no certificate, so x5t#S256 cannot be derived',
      );
    }

    const token = await mintRequestToken({
      consumerKey: creds.consumerKey,
      signingKeyPem: creds.signingKeyPem,
      certThumbprintS256: creds.signingCertThumbprintS256,
      certPem: creds.signingCertPem,
    });

    // Bare JWT, no "Bearer" prefix — Mastercard's spec says only "as 'Authorization'
    // header", and this is the form their own reference implementation sends. (A live
    // probe showed the sandbox also tolerates a `Bearer ` prefix; we match the docs.)
    return { Authorization: token };
  }
}
