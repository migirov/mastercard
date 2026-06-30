import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

// Cache of parsed PEM keyed by content (hash of material+password). forge's PKCS#12
// decode is CPU-heavy (~tens of ms); without the cache it would repeat on EVERY creds
// TTL expiry on a live request. Keyed by content → key rotation (new material) = new
// cache key = an honest re-parse.
//
// Capacity is BOUNDED (LRU): without it the cache would grow monotonically — each key
// rotation adds an entry forever, and old (revoked) private PEM keys would linger in
// process memory until restart (both memory and secret lifetime). On overflow, evict
// the least-recently-used (Map preserves insertion order; on a hit, move to the end).
const PEM_CACHE_MAX = 256;
const pemCache = new Map<string, string>();

function pemCacheGet(key: string): string | undefined {
  const pem = pemCache.get(key);
  if (pem !== undefined) {
    // recency: move to the end (most-recently-used).
    pemCache.delete(key);
    pemCache.set(key, pem);
  }
  return pem;
}

function pemCacheSet(key: string, pem: string): void {
  pemCache.set(key, pem);
  while (pemCache.size > PEM_CACHE_MAX) {
    const oldest = pemCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    pemCache.delete(oldest);
  }
}

/** Extracts the private key (PEM) from a PKCS#12 DER string. */
function privateKeyPemFromDer(
  der: string,
  password: string,
  label: string,
): string {
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
  const pem = forge.pki.privateKeyToPem(keyBag.key);
  pemCacheSet(cacheKey, pem);
  return pem;
}

/**
 * Loads the private key from a .p12 file by path and returns the PEM.
 * (PLATFORM mode and local development.)
 */
export function loadPrivateKeyFromP12(
  p12Path: string,
  password: string,
): string {
  const abs = path.isAbsolute(p12Path)
    ? p12Path
    : path.resolve(process.cwd(), p12Path);
  if (!fs.existsSync(abs)) {
    throw new Error(`Signing key file not found: ${abs}`);
  }
  const der = fs.readFileSync(abs, 'binary');
  return privateKeyPemFromDer(der, password, path.basename(abs));
}

/**
 * Loads the private key from a base64-encoded .p12 and returns the PEM.
 * (This is how keys arrive from AWS Secrets Manager in OWN mode.)
 */
export function loadPrivateKeyFromP12Base64(
  p12Base64: string,
  password: string,
): string {
  const der = Buffer.from(p12Base64, 'base64').toString('binary');
  return privateKeyPemFromDer(der, password, 'p12(base64)');
}
