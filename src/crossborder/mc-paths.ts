/**
 * Централизованные шаблоны путей Mastercard Cross-Border. Префиксы у MC
 * НЕОДНОРОДНЫ (это не баг — так в их API): держим их в ОДНОМ месте, чтобы
 * разница была явной и аудируемой, а не разбросанной по ~20 строковым литералам
 * (где `/send/` vs `/send/v1/` легко перепутать незаметно). Сгруппировано по базе:
 *
 *   - `/send/partners/{pid}/crossborder/...`     (БЕЗ v1): balances, account-/bank-/
 *     iban-lookup, RFI, quote-confirmations/-cancellations, retrieve-confirmed-quote;
 *   - `/send/v1/partners/{pid}/crossborder/...`  (v1):     rates, quotes, payment,
 *     retrieve/cancel;
 *   - `/crossborder/...`                          (без /send и без partner-id в пути;
 *     partner-id идёт ЗАГОЛОВКОМ): cash-pickup, endpoint-guide;
 *   - `/send/address-validation-service/...`      (собственная база address-validation).
 *
 * `partner` ОЖИДАЕТСЯ уже URL-encoded (см. CrossBorderService.partner()); id/ref в
 * сегментах пути кодируются здесь (encodeURIComponent). `qs` — готовая query-строка.
 */
export const mcPath = {
  // --- /send/partners/{pid}/crossborder/... (без v1) ---
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
  paymentByRef: (p: string, ref: string) =>
    `/send/v1/partners/${p}/crossborder?ref=${encodeURIComponent(ref)}`,
  cancelPayment: (p: string, id: string) =>
    `/send/v1/partners/${p}/crossborder/${encodeURIComponent(id)}/cancel`,

  // --- /crossborder/... (без /send; partner-id в заголовке) ---
  cashPickup: (sub: string, qs: string) =>
    `/crossborder/cash-pickup/${sub}${qs}`,
  endpointGuide: (qs: string) =>
    `/crossborder/endpoint-guide/specifications${qs}`,

  // --- собственная база address-validation ---
  addressValidations: () =>
    `/send/address-validation-service/addresses/validations`,
} as const;

// Формы query-параметров каталогов (snake_case = как ждёт MC). Держим тип в ОДНОМ
// месте рядом с путями — контроллер строит литерал, сервис принимает этот тип, и
// компилятор ловит рассинхрон имён полей (опечатка → ошибка типа, а не тихо
// пропавший фильтр).
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
