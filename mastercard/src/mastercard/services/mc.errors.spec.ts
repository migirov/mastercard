import {
  asTlsHandshakeError,
  AuthHeaderError,
  NonRetryableMcError,
  RequestEncryptError,
  ResponseDecryptError,
  TlsHandshakeError,
} from './mc.errors';

/**
 * `sent` is load-bearing for money: `CrossBorderGateway` turns it into
 * `executed: 'no' | 'unknown'`, which decides whether `PaymentIdempotencyStore`
 * RELEASES a payment slot or HOLDS it for the full 120s lock.
 *
 * Getting it wrong is silent and expensive in both directions — a false `sent=false`
 * lets a retry re-POST a payment Mastercard may already have executed; a false
 * `sent=true` 409s a merchant retrying a payment that never left the process.
 *
 * The values also depend on a compiler property (derived-class field initializers
 * running after the base class, which holds for `target: ES2021` but NOT if
 * `useDefineForClassFields` is ever turned on), so pin them explicitly.
 */
describe('mc.errors — sent classification', () => {
  it('pre-send failures are marked NOT sent → the idempotency slot may be released', () => {
    // Both are thrown by the REQUEST interceptor, before axios runs the adapter.
    expect(new RequestEncryptError('encrypt failed').sent).toBe(false);
    expect(new AuthHeaderError('mint failed').sent).toBe(false);
  });

  it('post-send failures are marked sent → the slot must be HELD (double-charge fail-safe)', () => {
    // Thrown by the RESPONSE interceptor: Mastercard saw the request and may have
    // executed the payment; the outcome is genuinely unknown.
    expect(new ResponseDecryptError('bad key').sent).toBe(true);
  });

  it('the base class defaults to the SAFE value', () => {
    expect(new NonRetryableMcError('x').sent).toBe(true);
  });

  it('every variant is non-retryable', () => {
    for (const e of [
      new RequestEncryptError('a'),
      new ResponseDecryptError('b'),
      new AuthHeaderError('c'),
    ]) {
      expect(e).toBeInstanceOf(NonRetryableMcError);
    }
  });

  it('preserves the underlying cause and reports the concrete subclass name', () => {
    const inner = new Error('boom');
    const wrapped = new AuthHeaderError('wrapper', inner);

    expect(wrapped.cause).toBe(inner);
    expect(wrapped.name).toBe('AuthHeaderError');
    expect(new ResponseDecryptError('x').name).toBe('ResponseDecryptError');
  });
});

/**
 * On MTF — where mTLS first becomes mandatory — a rejected handshake and an
 * unreachable Mastercard are the same opaque 502 without this classifier. The two
 * buckets are fixed in different places (our keystore vs. the trust anchors), so the
 * message has to say which one.
 *
 * The other half of the contract is what must NOT be classified: a genuinely
 * transient network code has to stay retryable on idempotent GETs.
 */
describe('asTlsHandshakeError — handshake taxonomy', () => {
  const HOST = 'mtf.api.xbs.mastercard.eu';
  const withCode = (code: string) => Object.assign(new Error('sock'), { code });

  it('blames OUR certificate for alerts Mastercard sends back about it', () => {
    for (const code of [
      'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
      'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
      'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA',
      'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE',
      'ERR_SSL_SSLV3_ALERT_CERTIFICATE_EXPIRED',
    ]) {
      const err = asTlsHandshakeError(withCode(code), HOST);
      expect(err?.reason).toBe('client-certificate');
      expect(err?.message).toContain('MC_MTLS_CLIENT_CERT_PATH');
    }
  });

  it('blames a bad keystore password the same way — same fix, same bucket', () => {
    const err = asTlsHandshakeError(
      withCode('ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE'),
      HOST,
    );
    expect(err?.reason).toBe('client-certificate');
  });

  it('blames THEIR certificate for verification failures we raise ourselves', () => {
    for (const code of [
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'CERT_HAS_EXPIRED',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ]) {
      const err = asTlsHandshakeError(withCode(code), HOST);
      expect(err?.reason).toBe('server-certificate');
      expect(err?.message).toContain('MC_MTLS_CA_PATH');
    }
  });

  it('still classifies an OpenSSL code this list does not name yet', () => {
    // The alert names vary between OpenSSL/Node versions; an unnamed one must not
    // fall through to the retry path.
    const err = asTlsHandshakeError(
      withCode('ERR_SSL_WRONG_VERSION_NUMBER'),
      HOST,
    );
    expect(err?.reason).toBe('handshake');
  });

  it('classifies the TLS 1.2 shape of the same rejection, where the code is only EPROTO', () => {
    // Verified against Node v20.20.2: a server refusing our client certificate
    // reports ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED under TLS 1.3 but a bare
    // EPROTO under TLS 1.2, with the alert only in the message. Same fault, same
    // verdict required — see mc-agent.handshake.spec.ts for the live proof.
    const err = asTlsHandshakeError(
      Object.assign(
        new Error(
          'write EPROTO ...:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:...',
        ),
        { code: 'EPROTO' },
      ),
      HOST,
    );
    expect(err?.reason).toBe('client-certificate');
    // The operator-visible code stays the real one, not the matched text.
    expect(err?.code).toBe('EPROTO');
  });

  it('classifies an unopenable keystore, which throws with no code at all', () => {
    // `createSecureContext` throws synchronously with a bare `mac verify failure`.
    // Reachable at request time for an OWN tenant whose mTLS password is wrong in
    // the SecretStore (the platform one is parsed and rejected at boot).
    const err = asTlsHandshakeError(new Error('mac verify failure'), HOST);
    expect(err?.reason).toBe('client-certificate');
  });

  it('leaves a bare EPROTO with no TLS signature alone — it may be transient', () => {
    expect(
      asTlsHandshakeError(
        Object.assign(new Error('write EPROTO'), { code: 'EPROTO' }),
        HOST,
      ),
    ).toBeUndefined();
  });

  it('leaves transient network failures alone — they MUST keep retrying', () => {
    for (const code of [
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ECONNREFUSED',
      'EPIPE',
      'ERR_CANCELED', // the AbortController killer at MC_REQUEST_TIMEOUT_MS
    ]) {
      expect(asTlsHandshakeError(withCode(code), HOST)).toBeUndefined();
    }
    expect(
      asTlsHandshakeError(new Error('no code at all'), HOST),
    ).toBeUndefined();
    expect(asTlsHandshakeError(undefined, HOST)).toBeUndefined();
  });

  it('reads the code out of a wrapping error too (axios substitutes its own)', () => {
    const wrapped = Object.assign(new Error('axios'), {
      code: 'ERR_BAD_REQUEST',
      cause: withCode('ERR_SSL_TLSV1_ALERT_UNKNOWN_CA'),
    });
    expect(asTlsHandshakeError(wrapped, HOST)?.reason).toBe(
      'client-certificate',
    );
  });

  it('is non-retryable and names the verdict in the message', () => {
    const err = asTlsHandshakeError(
      withCode('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'),
      HOST,
    );
    expect(err).toBeInstanceOf(NonRetryableMcError);
    expect(err?.name).toBe('TlsHandshakeError');
    expect(err?.message).toContain(HOST);
    // The gateway logs only `e.message`, so the verdict has to be IN it — this is
    // the string deploy/DEPLOY.md tells operators to grep for.
    expect(err?.message).toContain('[client-certificate]');
  });

  it('preserves the original error and passes an already-classified one through', () => {
    const sock = withCode('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(asTlsHandshakeError(sock, HOST)?.cause).toBe(sock);

    const already = new TlsHandshakeError(
      'x',
      'handshake',
      'ERR_SSL_X',
      'indeterminate',
    );
    expect(asTlsHandshakeError(already, HOST)).toBe(already);
  });
});

/**
 * `sent` decides whether `PaymentIdempotencyStore` RELEASES a payment slot or HOLDS
 * it, so "the TLS handshake failed" must not be confused with "nothing was sent".
 *
 * Measured on Node v20.20.2 with a byte-counting TCP proxy (reproduced live in
 * `mc-agent.handshake.spec.ts`): when the server refuses our client certificate over
 * TLS 1.3, a 4000-byte body puts 4003 MORE bytes on the wire than an empty one — the
 * client flushes the request before the server has validated the certificate. Over
 * TLS 1.2 the same rejection transmits nothing, and so does our own rejection of
 * THEIR certificate.
 *
 * So a received alert proves nothing about the wire, and the fail-safe answer for it
 * is `sent = true` (hold the slot). Only what we can reason about from our own side
 * is treated as provably unsent.
 */
describe('asTlsHandshakeError — what we can prove about the wire', () => {
  const HOST = 'mtf.api.xbs.mastercard.eu';
  const withCode = (code: string) => Object.assign(new Error('sock'), { code });

  it('an alert RECEIVED from Mastercard is treated as sent — the slot is HELD', () => {
    for (const code of [
      'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
      'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
      'ERR_SSL_TLSV1_ALERT_ACCESS_DENIED',
    ]) {
      const err = asTlsHandshakeError(withCode(code), HOST);
      expect(err?.evidence).toBe('indeterminate');
      // Releasing here would let a merchant retry re-POST a payment Mastercard may
      // already have executed.
      expect(err?.sent).toBe(true);
    }
  });

  it('an unopenable keystore is provably unsent — no socket was ever created', () => {
    // createSecureContext throws before connecting, so there is nothing on the wire.
    for (const e of [
      withCode('ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE'),
      new Error('mac verify failure'),
    ]) {
      const err = asTlsHandshakeError(e, HOST);
      expect(err?.evidence).toBe('no-socket');
      expect(err?.sent).toBe(false);
    }
  });

  it('rejecting THEIR certificate is provably unsent — we abort before writing', () => {
    for (const code of [
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ]) {
      const err = asTlsHandshakeError(withCode(code), HOST);
      expect(err?.evidence).toBe('aborted-by-us');
      expect(err?.sent).toBe(false);
    }
  });

  it('an unnamed OpenSSL failure defaults to sent — a keep-alive socket never handshook', () => {
    const err = asTlsHandshakeError(
      withCode('ERR_SSL_WRONG_VERSION_NUMBER'),
      HOST,
    );
    expect(err?.evidence).toBe('indeterminate');
    expect(err?.sent).toBe(true);
  });

  it('never re-judges an error we already classified', () => {
    // OpenSSL's `mac verify failure` is also what a JWE decryption failure can read
    // like, and that one is sent=true. Without this guard the classifier would flip
    // it to sent=false and release the slot for a payment Mastercard already saw.
    expect(
      asTlsHandshakeError(new ResponseDecryptError('mac verify failure'), HOST),
    ).toBeUndefined();
    expect(
      asTlsHandshakeError(new AuthHeaderError('alert unknown ca'), HOST),
    ).toBeUndefined();
    expect(
      asTlsHandshakeError(new RequestEncryptError('boom'), HOST),
    ).toBeUndefined();
  });

  it('derives `sent` from the evidence, not from a field initializer', () => {
    // Pins the compiler property this depends on: with `useDefineForClassFields`
    // turned on, a subclass field would clobber the constructor's assignment and
    // every value above would silently become the base class default.
    expect(
      new TlsHandshakeError('m', 'handshake', 'C', 'indeterminate').sent,
    ).toBe(true);
    expect(new TlsHandshakeError('m', 'handshake', 'C', 'no-socket').sent).toBe(
      false,
    );
    expect(
      new TlsHandshakeError('m', 'handshake', 'C', 'aborted-by-us').sent,
    ).toBe(false);
  });
});
