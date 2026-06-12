import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

// Кэш распарсенного PEM по контенту (хэш материала+пароля). forge PKCS#12-декод
// CPU-тяжёлый (~десятки мс); без кэша он повторялся бы на КАЖДОЕ истечение TTL
// кредов на живом запросе. Ключ по содержимому → ротация ключа (новый материал)
// = новый ключ кэша = честный ре-парс. Размер ограничен числом ключей (≈ партнёров).
const pemCache = new Map<string, string>();

/** Извлекает приватный ключ (PEM) из DER-строки PKCS#12. */
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
  const cached = pemCache.get(cacheKey);
  if (cached) return cached;

  const asn1 = forge.asn1.fromDer(der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    // strict=false — как читает официальная библиотека MC; иначе часть валидных
    // .p12 не проходит strict MAC-проверку forge.
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
  pemCache.set(cacheKey, pem);
  return pem;
}

/**
 * Загружает приватный ключ из .p12-файла по пути и возвращает PEM.
 * (Режим PLATFORM и локальная разработка.)
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
 * Загружает приватный ключ из base64-кодированного .p12 и возвращает PEM.
 * (Так ключи приходят из Vault/KMS в режиме OWN.)
 */
export function loadPrivateKeyFromP12Base64(
  p12Base64: string,
  password: string,
): string {
  const der = Buffer.from(p12Base64, 'base64').toString('binary');
  return privateKeyPemFromDer(der, password, 'p12(base64)');
}
