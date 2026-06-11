import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

/** Извлекает приватный ключ (PEM) из DER-строки PKCS#12. */
function privateKeyPemFromDer(
  der: string,
  password: string,
  label: string,
): string {
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
  return forge.pki.privateKeyToPem(keyBag.key);
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
