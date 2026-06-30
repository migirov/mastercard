/**
 * Event types that carry a transaction/quote status. SINGLE SOURCE for both sides of the
 * same data path:
 *  - the handler's WRITE decision (persist with status/stage vs. as a plain "other" event), and
 *  - the store's READ filter (only these go out through the merchant status poll).
 * Defining it once keeps the two in sync — add a third status type here and both paths follow.
 */
export const STATUS_EVENT_TYPES = ['STATUS_CHG', 'QUOTE_STATUS_CHG'];
