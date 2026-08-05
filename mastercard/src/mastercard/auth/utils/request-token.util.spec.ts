import { createVerify, generateKeyPairSync } from 'crypto';
import {
  REQUEST_TOKEN_TTL_SECONDS,
  mintRequestToken,
} from './request-token.util';

/**
 * Golden shape for Mastercard's OAUTH2_REQUEST_TOKEN. The expected header/claim set
 * comes from MC's published sample (docs/en/mc-oauth2/xbs-request-token-spec.md) and
 * was confirmed against the live sandbox — a token of this shape returns 200 on
 * sandbox.api.xbs.mastercard.eu, while truncating `kid` at '!' returns 500.
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CONSUMER_KEY = 'abc123!def456000000000000000000000000000000000000';
// Synthetic 43-char base64url value — the shape of a real x5t#S256, none of the substance.
const THUMB = 'A'.repeat(43);

const decode = (token: string) => {
  const [h, p, s] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')),
    claims: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')),
    signingInput: `${h}.${p}`,
    signature: Buffer.from(s, 'base64url'),
  };
};

const mint = (over: Record<string, unknown> = {}) =>
  mintRequestToken({
    consumerKey: CONSUMER_KEY,
    signingKeyPem: privateKey,
    certThumbprintS256: THUMB,
    ...over,
  });

describe('mintRequestToken', () => {
  it('builds the JOSE header Mastercard specifies', async () => {
    const { header } = decode(await mint());

    expect(header).toMatchObject({
      'x5t#S256': THUMB,
      kid: CONSUMER_KEY,
      cty: 'JWS',
      typ: 'JWT',
      alg: 'RS256',
    });
    // Pin the exact key SET too — toMatchObject ignores extras, so an accidental
    // additional member would otherwise ship to Mastercard unnoticed.
    expect(Object.keys(header).sort()).toEqual([
      'alg',
      'cty',
      'kid',
      'typ',
      'x5t#S256',
    ]);
  });

  it('sends the FULL consumer key as kid (truncating at "!" makes MC 500)', async () => {
    const { header } = decode(await mint());

    expect(header.kid).toBe(CONSUMER_KEY);
    expect(header.kid).toContain('!');
  });

  it('emits only the time-based claims — no iss/sub/aud', async () => {
    const { claims } = decode(await mint({ nowSeconds: 1_700_000_000 }));

    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'jti', 'nbf']);
  });

  it('backdates nbf/iat so a fast clock cannot invalidate the token', async () => {
    const now = 1_700_000_000;
    const { claims } = decode(await mint({ nowSeconds: now }));

    // The magnitude is the point: enough to absorb real pod clock drift against
    // Mastercard's validator, but not so much that it widens the replay window.
    expect(now - claims.nbf).toBeGreaterThanOrEqual(30);
    expect(now - claims.nbf).toBeLessThanOrEqual(300);
    expect(claims.iat).toBe(claims.nbf);
  });

  it('keeps the lifetime short — a replayable bearer token should not live long', async () => {
    const now = 1_700_000_000;
    const { claims } = decode(await mint({ nowSeconds: now }));

    expect(claims.exp).toBe(now + REQUEST_TOKEN_TTL_SECONDS);
    // Comfortably above the 30s per-request timeout so it cannot expire in flight,
    // and well under Mastercard's 900s sample.
    expect(REQUEST_TOKEN_TTL_SECONDS).toBeGreaterThanOrEqual(60);
    expect(REQUEST_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(300);
  });

  it('produces a signature the certificate key verifies', async () => {
    const { signingInput, signature } = decode(await mint());

    const ok = createVerify('RSA-SHA256')
      .update(signingInput)
      .end()
      .verify(publicKey, signature);
    expect(ok).toBe(true);
  });

  it('omits x5c when no certificate is supplied, includes bare DER when it is', async () => {
    expect(decode(await mint()).header.x5c).toBeUndefined();

    const certPem =
      '-----BEGIN CERTIFICATE-----\nAAAABBBB\nCCCC\n-----END CERTIFICATE-----\n';
    const { header } = decode(await mint({ certPem }));

    // x5c carries base64 DER with the armour and newlines stripped (RFC 7515 §4.1.6).
    expect(header.x5c).toEqual(['AAAABBBBCCCC']);
  });

  it('takes only the leaf from a certificate chain — one x5c entry per certificate', async () => {
    const chain =
      '-----BEGIN CERTIFICATE-----\nLEAF\n-----END CERTIFICATE-----\n' +
      '-----BEGIN CERTIFICATE-----\nISSUER\n-----END CERTIFICATE-----\n';

    const { header } = decode(await mint({ certPem: chain }));

    expect(header.x5c).toEqual(['LEAF']);
  });

  it('gives every token a unique jti', async () => {
    const [a, b] = [decode(await mint()), decode(await mint())];
    expect(a.claims.jti).not.toBe(b.claims.jti);
  });

  it('refuses to mint without the certificate thumbprint', async () => {
    await expect(mint({ certThumbprintS256: undefined })).rejects.toThrow(
      /x5t#S256/,
    );
  });

  it('refuses to mint without a consumer key', async () => {
    await expect(mint({ consumerKey: '' })).rejects.toThrow(/kid/);
  });
});
