/**
 * Единый предикат «слабого» секрета для прод-гейтов. Используется в ДВУХ местах
 * (dev-харнесс `main.ts:assertProdSecrets` читает `process.env`; встраиваемый
 * `GatewayConfig` читает типизированные опции) — держим определение в одном месте,
 * чтобы пороги не разъезжались при правке.
 *
 * Слабый = пустой, короче 24 символов, содержит `change-me` или начинается с `dev-`.
 */
export const isWeakSecret = (v?: string): boolean =>
  !v || v.length < 24 || v.includes('change-me') || v.startsWith('dev-');
