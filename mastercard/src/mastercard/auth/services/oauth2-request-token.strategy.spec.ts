import { generateKeyPairSync } from 'crypto';
import { McCredentials } from '../../../credentials/credentials.types';
import { McOutboundRequest } from '../mc-auth.types';
import { OAuth2RequestTokenStrategy } from './oauth2-request-token.strategy';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const creds = {
  consumerKey: 'ck!suffix',
  signingKeyPem: privateKey,
  partnerId: 'PID12345',
  signingCertThumbprintS256: 'A'.repeat(43),
} as McCredentials;

const req: McOutboundRequest = {
  method: 'POST',
  url: 'https://sandbox.api.xbs.mastercard.eu/send/v1/partners/P/crossborder/quotes',
  payload: '{"quoterequest":{}}',
};

describe('OAuth2RequestTokenStrategy', () => {
  const strategy = new OAuth2RequestTokenStrategy();

  it('puts a BARE JWT in Authorization — no "Bearer " prefix', async () => {
    const headers = await strategy.authHeaders(creds, req);

    // Mastercard's spec says only "as 'Authorization' header"; their reference
    // implementation sends the token bare, and a live probe confirmed it works.
    expect(headers.Authorization).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(headers.Authorization).not.toMatch(/^Bearer /);
  });

  it('sets exactly one header and nothing else', async () => {
    expect(Object.keys(await strategy.authHeaders(creds, req))).toEqual([
      'Authorization',
    ]);
  });

  it('maps the tenant credentials into the JOSE header — signing cert, not the JWE key', async () => {
    const withCert = {
      ...creds,
      signingCertPem:
        '-----BEGIN CERTIFICATE-----\nLEAFDER\n-----END CERTIFICATE-----\n',
      // A decoy: the 64-hex JWE key fingerprint is a DIFFERENT namespace and must
      // never end up as x5t#S256 (it would fail every call on the EU edge).
      encryptionFingerprint: 'de'.repeat(32),
    } as McCredentials;

    const { Authorization } = await strategy.authHeaders(withCert, req);
    const header = JSON.parse(
      Buffer.from(Authorization.split('.')[0], 'base64url').toString(),
    );

    expect(header.kid).toBe(withCert.consumerKey);
    expect(header['x5t#S256']).toBe(withCert.signingCertThumbprintS256);
    expect(header['x5t#S256']).not.toBe(withCert.encryptionFingerprint);
    expect(header.x5c).toEqual(['LEAFDER']);
  });

  it('does not bind the token to the request — header and claims are URL/method independent', async () => {
    const decode = (h: string) => ({
      header: JSON.parse(Buffer.from(h.split('.')[0], 'base64url').toString()),
      claims: JSON.parse(Buffer.from(h.split('.')[1], 'base64url').toString()),
      signingInput: h.split('.').slice(0, 2).join('.'),
    });

    const a = decode((await strategy.authHeaders(creds, req)).Authorization);
    const b = decode(
      (
        await strategy.authHeaders(creds, {
          method: 'GET',
          url: 'https://sandbox.api.xbs.mastercard.eu/a-quite-different-path',
        })
      ).Authorization,
    );

    expect(a.header).toEqual(b.header);
    // Claims may differ ONLY by jti (and, across a second boundary, the timestamps).
    expect({ ...a.claims, jti: 0, iat: 0, nbf: 0, exp: 0 }).toEqual({
      ...b.claims,
      jti: 0,
      iat: 0,
      nbf: 0,
      exp: 0,
    });
    expect(a.claims.jti).not.toBe(b.claims.jti);
    // No URL material is carried into the signed input.
    expect(a.signingInput).not.toContain('quite-different-path');
  });

  it('refuses loudly when the .p12 carried no certificate', async () => {
    const noCert = { ...creds, signingCertThumbprintS256: undefined };

    await expect(strategy.authHeaders(noCert, req)).rejects.toThrow(
      /requires the signing certificate/,
    );
  });

  it('reports its mode', () => {
    expect(strategy.mode).toBe('oauth2-request-token');
  });
});
