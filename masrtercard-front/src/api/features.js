// "Features" — the Mastercard cross-border APIs that aren't part of the core payment flow.
// Each call hits the demo BFF's /features/* endpoints, which (per env) either proxy the live
// gateway/Mastercard sandbox or synthesize a demo response. Every result carries a
// `source: 'live' | 'demo'` flag so each page can show whether the data is real.
import { demoApi } from './demoApi';

const enc = encodeURIComponent;

/** Build a `?a=1&b=2` query string, skipping null/empty values. */
function qs(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v != null && v !== '') u.set(k, v);
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const features = {
  /** { name, country, bic? } → { banks:[{name,bic,branch,country,address}], total, source } */
  bankLookup: (body) => demoApi.post('/features/bank-lookup', body),

  /** { country, ban?, branchCode?, accountNo? } → { iban, ban?, bank?, source } */
  iban: (body) => demoApi.post('/features/iban', body),

  /** Cash-pickup catalogs → { items:[...], total?, source } */
  cashPickup: {
    countries: (p) => demoApi.get(`/features/cash-pickup/countries${qs(p)}`),
    cities: (p) => demoApi.get(`/features/cash-pickup/cities${qs(p)}`),
    providers: (p) => demoApi.get(`/features/cash-pickup/providers${qs(p)}`),
    branches: (p) => demoApi.get(`/features/cash-pickup/branches${qs(p)}`),
  },

  /** { base?, quote? } → { base?, rates:[{pair,rate,change?}], asOf, source } */
  rates: (p) => demoApi.get(`/features/rates${qs(p)}`),

  /** corridor query → { corridor, fields:[...], limits, source } */
  endpointGuide: (p) => demoApi.get(`/features/endpoint-guide${qs(p)}`),

  /** Quote lifecycle: confirm / cancel / retrieve a proposal. */
  quoteLifecycle: {
    confirm: (body) => demoApi.post('/features/quote-lifecycle/confirm', body),
    cancel: (body) => demoApi.post('/features/quote-lifecycle/cancel', body),
    retrieve: (p) => demoApi.get(`/features/quote-lifecycle/retrieve${qs(p)}`),
  },

  /** Payment tracker: status/history by ref + cancel by id. */
  paymentTracker: {
    track: (ref) => demoApi.get(`/features/payment-tracker${qs({ ref })}`),
    cancel: (id) => demoApi.post('/features/payment-tracker/cancel', { id }),
  },

  /**
   * RFI:
   *  retrieve(requestId) → { requestId, status, questions, source }
   *  respond(requestId, { firstName?, lastName?, message? }) → { requestId, state, source }
   *  upload({ fileName, file }) → { documentId, fileName, state, source }  (file = base64)
   */
  rfi: {
    retrieve: (requestId) => demoApi.get(`/features/rfi/requests/${enc(requestId)}`),
    respond: (requestId, body) =>
      demoApi.post(`/features/rfi/requests/${enc(requestId)}`, body),
    upload: (body) => demoApi.post('/features/rfi/documents', body),
  },
};
