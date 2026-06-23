/**
 * Local types for the Mastercard CommonJS packages that ship without declarations.
 * Minimal signatures matching actual usage — to remove `any`/`require()` at the crypto
 * boundary (OAuth1 signature and JWE).
 */
declare module 'mastercard-oauth1-signer' {
  /** Builds the `Authorization: OAuth ...` header for a request to Mastercard. */
  export function getAuthorizationHeader(
    uri: string,
    method: string,
    payload: string | undefined,
    consumerKey: string,
    signingKey: string,
  ): string;
}

declare module 'mastercard-client-encryption' {
  /** Mastercard field-level encryption (JWE). */
  export class JweEncryption {
    constructor(config: unknown);
    encrypt(
      path: string,
      headers: Record<string, unknown>,
      body: unknown,
    ): { body: unknown };
    decrypt(input: { request: { url: string }; body: unknown }): unknown;
  }
}
