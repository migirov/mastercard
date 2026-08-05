import { Injectable } from '@nestjs/common';
// import = require: typed (see types/mastercard.d.ts) but identical at runtime. require is
// needed because getAuthorizationHeader is called as a module method (needs this-binding).
import oauth = require('mastercard-oauth1-signer');
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McAuthMode,
  McAuthStrategy,
  McOutboundRequest,
} from '../mc-auth.types';

/**
 * OAuth 1.0a request signing — the scheme Mastercard's `.com` endpoints require.
 * The signature covers the method, the full URL and the FINAL body, so this must
 * run after encryption; the interceptor guarantees that ordering.
 */
@Injectable()
export class OAuth1Strategy implements McAuthStrategy {
  readonly mode: McAuthMode = 'oauth1';

  async authHeaders(
    creds: McCredentials,
    req: McOutboundRequest,
  ): Promise<Record<string, string>> {
    return {
      Authorization: oauth.getAuthorizationHeader(
        req.url,
        req.method,
        req.payload,
        creds.consumerKey,
        creds.signingKeyPem,
      ),
    };
  }
}
