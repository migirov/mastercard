/**
 * Локальные типы для CommonJS-пакетов Mastercard, которые поставляются без
 * деклараций. Минимальные сигнатуры под фактическое использование — чтобы
 * убрать `any`/`require()` на крипто-границе (OAuth1-подпись и JWE).
 */
declare module 'mastercard-oauth1-signer' {
  /** Формирует заголовок `Authorization: OAuth ...` для запроса к Mastercard. */
  export function getAuthorizationHeader(
    uri: string,
    method: string,
    payload: string | undefined,
    consumerKey: string,
    signingKey: string,
  ): string;
}

declare module 'mastercard-client-encryption' {
  /** Field-level encryption (JWE) Mastercard. */
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
