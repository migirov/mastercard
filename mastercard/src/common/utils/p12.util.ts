import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import * as forge from 'node-forge';

/** Module-scope: these are pure functions, not providers. */
const logger = new Logger('p12.util');

/**
 * Signing material extracted from a PKCS#12: the private key plus the leaf
 * certificate that pairs with it.
 *
 * OAuth 1.0a needs only `privateKeyPem`. The Mastercard OAuth2 "Request Token"
 * (PSD2 EU/UK edges) additionally needs the certificate: `x5t#S256` in the JOSE
 * header is `certThumbprintS256`, and the optional `x5c` is the DER inside
 * `certPem`.
 */
export interface P12SigningMaterial {
  readonly privateKeyPem: string;
  /**
   * Leaf signing certificate, PEM-armoured. Absent when the .p12 holds only a key
   * — valid for OAuth 1.0a and for decryption keys, which never need it.
   */
  readonly certPem?: string;
  /**
   * base64url(SHA-256(DER)) of the leaf certificate — the JOSE `x5t#S256`
   * (RFC 7515 §4.1.8). NOTE: base64url, NOT hex — do not confuse this with
   * `encryptionFingerprint`, which is the 64-hex SHA-256 of a public KEY.
   * Absent for the same reason as `certPem`.
   */
  readonly certThumbprintS256?: string;
  /**
   * Expiry of the leaf certificate. forge has already parsed it, so carrying it
   * costs nothing — and without it an expired signing certificate surfaces only as
   * an opaque 401 from Mastercard on every call, with nothing in the logs pointing
   * at the clock. Mastercard renews project keys annually.
   */
  readonly certNotAfter?: Date;
}

// Cache of parsed material keyed by content (hash of material+password). forge's
// PKCS#12 decode is CPU-heavy (~tens of ms); without the cache it would repeat on
// EVERY creds TTL expiry on a live request. Keyed by content → key rotation (new
// material) = new cache key = an honest re-parse.
//
// Capacity is BOUNDED (LRU): without it the cache would grow monotonically — each key
// rotation adds an entry forever, and old (revoked) private PEM keys would linger in
// process memory until restart (both memory and secret lifetime). On overflow, evict
// the least-recently-used (Map preserves insertion order; on a hit, move to the end).
const PEM_CACHE_MAX = 256;
const pemCache = new Map<string, P12SigningMaterial>();

function pemCacheGet(key: string): P12SigningMaterial | undefined {
  const mat = pemCache.get(key);
  if (mat !== undefined) {
    // recency: move to the end (most-recently-used).
    pemCache.delete(key);
    pemCache.set(key, mat);
  }
  return mat;
}

function pemCacheSet(key: string, mat: P12SigningMaterial): void {
  pemCache.set(key, mat);
  while (pemCache.size > PEM_CACHE_MAX) {
    const oldest = pemCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    pemCache.delete(oldest);
  }
}

/**
 * Pick the certificate that belongs to the private key, or `undefined` if the p12
 * carries none.
 *
 * Absence is NOT an error here: only the OAuth2 request token needs the
 * certificate, and a key-only .p12 is perfectly valid for OAuth 1.0a signing and
 * for a JWE decryption key. The oauth2 path fails loudly at its own point of use
 * (`mintRequestToken` rejects a missing thumbprint), so keeping this permissive
 * avoids breaking callers that never wanted a certificate.
 *
 * Ambiguity resolves to `undefined` for the same reason rather than throwing: a p12
 * may carry a whole chain, and thumbprinting a CA instead of the leaf would yield a
 * token Mastercard rejects with an opaque error — but refusing outright here would
 * break the OAuth1 and decryption-key paths, which never look at the certificate.
 * Returning nothing lets those succeed while the OAuth2 path still fails loudly with
 * a message that names the real problem.
 */
function pickLeafCert(
  certBags: forge.pkcs12.Bag[],
  keyBag: forge.pkcs12.Bag,
  label: string,
): forge.pki.Certificate | undefined {
  if (certBags.length === 0) {
    return undefined;
  }
  if (certBags.length === 1) {
    return certBags[0].cert as forge.pki.Certificate;
  }

  // Match on the public modulus FIRST: that the certificate's public key pairs
  // with our private key is cryptographically verifiable, whereas localKeyId is
  // only a label a packer may have applied to the wrong bag. Thumbprinting a cert
  // whose key we cannot sign with would produce a token Mastercard cannot verify.
  const n = (keyBag.key as forge.pki.rsa.PrivateKey | undefined)?.n;
  if (n) {
    const byModulus = certBags.filter((b) => {
      const pub = b.cert?.publicKey as forge.pki.rsa.PublicKey | undefined;
      return pub?.n?.compareTo(n) === 0;
    });
    if (byModulus.length === 1) {
      return byModulus[0].cert as forge.pki.Certificate;
    }
  }

  // Fallback for non-RSA keys: PKCS#12 pairs a key with its cert via localKeyId.
  const keyId = keyBag.attributes?.localKeyId?.[0];
  if (keyId) {
    const byId = certBags.filter(
      (b) => b.attributes?.localKeyId?.[0] === keyId,
    );
    if (byId.length === 1) return byId[0].cert as forge.pki.Certificate;
  }

  // Ambiguous: report nothing rather than guess. Callers that need the certificate
  // (only the OAuth2 request token) fail loudly on the missing thumbprint; callers
  // that do not — OAuth 1.0a signing, JWE decryption keys — are unaffected.
  logger.warn(
    `Cannot identify the leaf signing certificate in ${label}: ` +
      `${certBags.length} certificates and neither localKeyId nor the public ` +
      `modulus disambiguates them — continuing without a certificate`,
  );
  return undefined;
}

/** Extracts the private key and its leaf certificate from a PKCS#12 DER string. */
function signingMaterialFromDer(
  der: string,
  password: string,
  label: string,
): P12SigningMaterial {
  const cacheKey = createHash('sha256')
    .update(der, 'binary')
    .update('\0')
    .update(password)
    .digest('hex');
  const cached = pemCacheGet(cacheKey);
  if (cached) return cached;

  const asn1 = forge.asn1.fromDer(der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    // strict=false — same as MC's official library reads it; otherwise some valid
    // .p12 files fail forge's strict MAC check.
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new Error(
      `Failed to open ${label} (wrong password or incompatible p12)`,
    );
  }

  const bags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];

  const keyBag = bags?.[0];
  if (!keyBag?.key) {
    throw new Error(`No private key found in ${label}`);
  }

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ??
    [];
  const cert = pickLeafCert(certBags, keyBag, label);
  const certDer = cert
    ? Buffer.from(
        forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
        'binary',
      )
    : undefined;

  const material: P12SigningMaterial = {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certPem: cert ? forge.pki.certificateToPem(cert) : undefined,
    certThumbprintS256: certDer
      ? createHash('sha256').update(certDer).digest('base64url')
      : undefined,
    certNotAfter: cert?.validity?.notAfter,
  };
  pemCacheSet(cacheKey, material);
  return material;
}

/**
 * Loads the signing material (private key + leaf certificate) from a .p12 file by
 * path. (PLATFORM mode and local development.) The path is expected ABSOLUTE — the
 * host/harness resolves it, so this util does not read process.cwd().
 */
export function loadSigningMaterialFromP12(
  p12Path: string,
  password: string,
): P12SigningMaterial {
  if (!fs.existsSync(p12Path)) {
    throw new Error(`Signing key file not found: ${p12Path}`);
  }
  const der = fs.readFileSync(p12Path, 'binary');
  return signingMaterialFromDer(der, password, path.basename(p12Path));
}

/**
 * Loads the signing material from a base64-encoded .p12.
 * (This is how keys arrive from AWS Secrets Manager in OWN mode.)
 */
export function loadSigningMaterialFromP12Base64(
  p12Base64: string,
  password: string,
): P12SigningMaterial {
  const der = Buffer.from(p12Base64, 'base64').toString('binary');
  return signingMaterialFromDer(der, password, 'p12(base64)');
}

/** Private key PEM only — the OAuth 1.0a path, unchanged for its callers. */
export function loadPrivateKeyFromP12(
  p12Path: string,
  password: string,
): string {
  return loadSigningMaterialFromP12(p12Path, password).privateKeyPem;
}

/** Private key PEM only, from a base64-encoded .p12. */
export function loadPrivateKeyFromP12Base64(
  p12Base64: string,
  password: string,
): string {
  return loadSigningMaterialFromP12Base64(p12Base64, password).privateKeyPem;
}
