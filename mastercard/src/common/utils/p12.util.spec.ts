import { createHash, generateKeyPairSync } from 'crypto';
import * as forge from 'node-forge';
import {
  loadPrivateKeyFromP12Base64,
  loadSigningMaterialFromP12Base64,
} from './p12.util';

/**
 * The real signing .p12 is not in git (certs/ is ignored), so these tests build
 * their own PKCS#12 in-memory. That also keeps the thumbprint assertion honest:
 * it is checked against an independently computed SHA-256 over the certificate
 * DER rather than a copied constant.
 */

const PASSWORD = 'test-password';
const BITS = 2048;

interface Pair {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
}

function makePair(cn: string): Pair {
  // Node's native keygen, not forge's — forge's synchronous generateKeyPair takes
  // minutes here, which would dominate the whole unit-test run.
  const generated = generateKeyPairSync('rsa', {
    modulusLength: BITS,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const keys = {
    privateKey: forge.pki.privateKeyFromPem(generated.privateKey),
    publicKey: forge.pki.publicKeyFromPem(generated.publicKey),
  };
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: cn }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return { key: keys.privateKey, cert };
}

function toP12Base64(
  key: forge.pki.rsa.PrivateKey,
  certs: forge.pki.Certificate[],
): string {
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, certs, PASSWORD, {
    // forge derives the localKeyId from the FIRST certificate, so it cannot be
    // generated for a key-only bundle.
    generateLocalKeyId: certs.length > 0,
    friendlyName: 'test',
  });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary').toString(
    'base64',
  );
}

/** base64url(SHA-256(DER)) — the JOSE x5t#S256, computed independently here. */
function expectedThumbprint(cert: forge.pki.Certificate): string {
  const der = Buffer.from(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
    'binary',
  );
  return createHash('sha256').update(der).digest('base64url');
}

describe('p12.util signing material', () => {
  let leaf: Pair;
  let other: Pair;

  beforeAll(() => {
    leaf = makePair('LeafSigningKey');
    other = makePair('SomeOtherKey');
  }, 30_000);

  it('extracts the private key, the certificate and its x5t#S256 thumbprint', () => {
    const p12 = toP12Base64(leaf.key, [leaf.cert]);

    const mat = loadSigningMaterialFromP12Base64(p12, PASSWORD);

    expect(mat.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
    expect(mat.certPem).toContain('BEGIN CERTIFICATE');
    expect(mat.certThumbprintS256).toBe(expectedThumbprint(leaf.cert));
  });

  it('produces a base64url thumbprint, not hex and not padded base64', () => {
    const p12 = toP12Base64(leaf.key, [leaf.cert]);

    const { certThumbprintS256 } = loadSigningMaterialFromP12Base64(
      p12,
      PASSWORD,
    );

    // 32 raw bytes → 43 base64url chars, no padding, no '+' or '/'.
    expect(certThumbprintS256).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('picks the cert that actually pairs with the private key, not the first one', () => {
    // The unrelated cert goes first on purpose: forge's packer stamps localKeyId
    // onto the FIRST cert regardless of which key it belongs to, so this fixture
    // has a mislabelled bag. Selection must follow the public modulus (verifiable)
    // rather than that label, or we would thumbprint a cert we cannot sign for.
    const p12 = toP12Base64(leaf.key, [other.cert, leaf.cert]);

    const mat = loadSigningMaterialFromP12Base64(p12, PASSWORD);

    expect(mat.certThumbprintS256).toBe(expectedThumbprint(leaf.cert));
    expect(mat.certThumbprintS256).not.toBe(expectedThumbprint(other.cert));
  });

  it('keeps the private-key-only helper working for the OAuth1 path', () => {
    const p12 = toP12Base64(leaf.key, [leaf.cert]);

    expect(loadPrivateKeyFromP12Base64(p12, PASSWORD)).toBe(
      loadSigningMaterialFromP12Base64(p12, PASSWORD).privateKeyPem,
    );
  });

  it('accepts a key-only .p12 — OAuth1 signing and decryption keys need no certificate', () => {
    // Regression guard: certificate extraction was added for the OAuth2 request
    // token, and must not turn "has a key" into "must also carry a certificate" for
    // the paths that never wanted one (`openssl pkcs12 -export -nocerts`).
    const p12 = toP12Base64(leaf.key, []);

    const mat = loadSigningMaterialFromP12Base64(p12, PASSWORD);

    expect(mat.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
    expect(mat.certPem).toBeUndefined();
    expect(mat.certThumbprintS256).toBeUndefined();
    expect(() => loadPrivateKeyFromP12Base64(p12, PASSWORD)).not.toThrow();
  });

  it('rejects a wrong password without leaking the material', () => {
    const p12 = toP12Base64(leaf.key, [leaf.cert]);

    expect(() => loadSigningMaterialFromP12Base64(p12, 'wrong')).toThrow(
      /wrong password or incompatible p12/,
    );
  });
});
