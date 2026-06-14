import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

// Кэш распарсенного PEM по контенту (хэш материала+пароля). forge PKCS#12-декод
// CPU-тяжёлый (~десятки мс); без кэша он повторялся бы на КАЖДОЕ истечение TTL
// кредов на живом запросе. Ключ по содержимому → ротация ключа (новый материал)
// = новый ключ кэша = честный ре-парс.
//
// Ёмкость ОГРАНИЧЕНА (LRU): без неё кэш рос бы монотонно — каждая ротация ключа
// добавляет запись навсегда, и старые (отозванные) приватные PEM-ключи висели бы
// в памяти процесса до рестарта (и память, и срок жизни секрета). При переполнении
// выселяем least-recently-used (Map хранит порядок вставки; на hit двигаем в конец).
const PEM_CACHE_MAX = 256;
const pemCache = new Map<string, string>();

function pemCacheGet(key: string): string | undefined {
  const pem = pemCache.get(key);
  if (pem !== undefined) {
    // recency: переставляем в конец (most-recently-used).
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
  const cached = pemCacheGet(cacheKey);
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
  pemCacheSet(cacheKey, pem);
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
