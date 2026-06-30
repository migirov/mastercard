// Cross-border (XBS) operations — the part of the UI that maps to the real Mastercard
// gateway. These go to the demo BFF's /xbs/* endpoints, which (per env) either proxy the
// live gateway/Mastercard sandbox (FX quote, validation, balances) or synthesize a demo
// response (payment submit, status — until MTF/Prod is enabled). Every result carries a
// `source: 'live' | 'demo'` flag so the UI can show what's real.
import { demoApi } from './demoApi';

export const xbs = {
  /** { source_currency, target_currency, amount } → { fx_rate, mid_rate, spread_pct, source_amount, target_amount, source } */
  quote: (body) => demoApi.post('/xbs/quote', body),
  /** { iban, country? } → { valid, normalized?, source } */
  validateAccount: (body) => demoApi.post('/xbs/validate-account', body),
  /** { address } → { valid, source } */
  validateAddress: (body) => demoApi.post('/xbs/validate-address', body),
  /** → { balances: [{ currency, available }], source } */
  balances: () => demoApi.get('/xbs/balances'),
  /** { transaction_reference, payment_currency, payment_amount, beneficiary_account, ... } → { payment_ref, status, source } */
  pay: (body) => demoApi.post('/xbs/pay', body),
  /** ref → { ref, status, stage?, history, source } */
  status: (ref) => demoApi.get(`/xbs/status?ref=${encodeURIComponent(ref)}`),
};
