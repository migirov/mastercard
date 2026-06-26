/**
 * Centralized Mastercard Cross-Border path templates. MC's prefixes are
 * NON-UNIFORM (not a bug — that's how their API is): we keep them in ONE place so
 * the difference is explicit and auditable, rather than scattered across ~20
 * string literals (where `/send/` vs `/send/v1/` is easy to mix up unnoticed).
 * Grouped by base:
 *
 *   - `/send/partners/{pid}/crossborder/...`     (WITHOUT v1): balances, account-/bank-/
 *     iban-lookup, RFI, quote-confirmations/-cancellations, retrieve-confirmed-quote;
 *   - `/send/v1/partners/{pid}/crossborder/...`  (v1):     rates, quotes, payment,
 *     retrieve/cancel;
 *   - `/crossborder/...`                          (without /send and without a partner-id
 *     in the path; partner-id goes in the HEADER): cash-pickup, endpoint-guide;
 *   - `/send/address-validation-service/...`      (address-validation's own base).
 *
 * `partner` is EXPECTED to already be URL-encoded (see CrossBorderGateway.partner());
 * id/ref in path segments are encoded here (encodeURIComponent). `qs` is a ready query string.
 */
export const mcPath = {
  // --- /send/partners/{pid}/crossborder/... (without v1) ---
  balances: (p: string) =>
    `/send/partners/${p}/crossborder/accounts?include_balance=true`,
  accountValidations: (p: string) =>
    `/send/partners/${p}/crossborder/accounts/validations`,
  bankDetails: (p: string) => `/send/partners/${p}/crossborder/banks/details`,
  generateIbans: (p: string) =>
    `/send/partners/${p}/crossborder/accounts/generate-ibans`,
  quoteConfirmations: (p: string) =>
    `/send/partners/${p}/crossborder/quotes/confirmations`,
  quoteCancellations: (p: string) =>
    `/send/partners/${p}/crossborder/quotes/cancellations`,
  retrieveConfirmedQuote: (p: string, ref: string, proposalId: string) =>
    `/send/partners/${p}/crossborder/quotes/${encodeURIComponent(ref)}/proposals/${encodeURIComponent(proposalId)}`,
  rfiRequest: (p: string, requestId: string) =>
    `/send/partners/${p}/crossborder/rfi/requests/${encodeURIComponent(requestId)}`,
  rfiDocuments: (p: string) => `/send/partners/${p}/crossborder/rfi/documents`,
  rfiDocument: (p: string, documentId: string) =>
    `/send/partners/${p}/crossborder/rfi/documents/${encodeURIComponent(documentId)}`,

  // --- /send/v1/partners/{pid}/crossborder/... (v1) ---
  rates: (p: string) => `/send/v1/partners/${p}/crossborder/rates`,
  quotes: (p: string) => `/send/v1/partners/${p}/crossborder/quotes`,
  payment: (p: string) => `/send/v1/partners/${p}/crossborder/payment`,
  paymentById: (p: string, id: string) =>
    `/send/v1/partners/${p}/crossborder/${encodeURIComponent(id)}`,
  // The single mandatory `ref` is encoded inline here (not via the gateway's `qs`, which
  // is for optional filter bags) — same encodeURIComponent guarantee, one obvious param.
  paymentByRef: (p: string, ref: string) =>
    `/send/v1/partners/${p}/crossborder?ref=${encodeURIComponent(ref)}`,
  cancelPayment: (p: string, id: string) =>
    `/send/v1/partners/${p}/crossborder/${encodeURIComponent(id)}/cancel`,

  // --- /crossborder/... (without /send; partner-id in the header) ---
  cashPickup: (sub: string, qs: string) =>
    `/crossborder/cash-pickup/${sub}${qs}`,
  endpointGuide: (qs: string) =>
    `/crossborder/endpoint-guide/specifications${qs}`,

  // --- address-validation's own base ---
  addressValidations: () =>
    `/send/address-validation-service/addresses/validations`,
} as const;

// Shapes of catalog query parameters (snake_case = as MC expects). We keep the
// type in ONE place next to the paths — the controller builds the literal, the
// service accepts this type, and the compiler catches field-name drift (a typo →
// a type error, not a silently dropped filter).
export interface CashPickupCitiesQuery {
  country?: string;
  currency?: string;
  offset?: string;
  limit?: string;
}
export interface CashPickupProvidersQuery {
  country?: string;
  currency?: string;
  cash_pickup_type?: string;
  offset?: string;
  limit?: string;
}
export interface CashPickupBranchesQuery {
  provider_id?: string;
  state?: string;
  city?: string;
  offset?: string;
  limit?: string;
}
export interface EndpointGuideQuery {
  payment_type?: string;
  destination_country?: string;
  destination_currency?: string;
  destination_payment_instrument?: string;
}
