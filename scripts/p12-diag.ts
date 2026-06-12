/* Диагностика .p12: точная ошибка forge + состав «мешков». npm run p12-diag */
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

function diag(label: string, p12Path?: string, password?: string) {
  console.log(`\n=== ${label} ===`);
  if (!p12Path) {
    console.log('путь не задан');
    return;
  }
  const abs = path.resolve(process.cwd(), p12Path);
  const der = fs.readFileSync(abs, 'binary');
  console.log(`файл: ${path.basename(abs)} | размер: ${der.length} байт`);
  console.log(`пароль (длина): ${password ? password.length : 0}`);

  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(der);
  } catch (e) {
    console.log(`asn1.fromDer ОШИБКА: ${(e as Error).message}`);
    return;
  }

  for (const [mode, strict] of [
    ['strict', true],
    ['non-strict', false],
  ] as const) {
    try {
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, strict, password);
      const cnt = (oid: string) =>
        (p12.getBags({ bagType: oid })[oid] || []).length;
      console.log(
        `[${mode}] OK — shroudedKey:${cnt(forge.pki.oids.pkcs8ShroudedKeyBag)} ` +
          `key:${cnt(forge.pki.oids.keyBag)} cert:${cnt(forge.pki.oids.certBag)}`,
      );
    } catch (e) {
      console.log(`[${mode}] FAIL — ${(e as Error).message}`);
    }
  }
}

diag(
  'SIGNING',
  process.env.MC_SIGNING_KEY_PATH,
  process.env.MC_SIGNING_KEY_PASSWORD,
);
diag(
  'ENCRYPTION',
  process.env.MC_ENCRYPTION_KEY_PATH,
  process.env.MC_ENCRYPTION_KEY_PASSWORD,
);
