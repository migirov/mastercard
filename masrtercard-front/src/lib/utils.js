import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}


export const isIframe = window.self !== window.top;

/**
 * Allow only http(s) URLs; anything else (javascript:, data:, blob:, vbscript:, …) → null.
 * Invoice `file_url`s come from the open, unauthenticated entity store, so they must be
 * scheme-checked before being rendered into an `href`/`iframe src` (prevents stored XSS).
 */
export function safeHttpUrl(u) {
  if (typeof u !== 'string') return null;
  // Return the TRIMMED value, not the raw one. Validating one string and returning another is
  // the shape that becomes exploitable the moment the predicate grows: here the mismatch was
  // merely wrong (leading whitespace the URL parser does not strip turns a valid absolute URL
  // into a broken same-origin path), but "check X, use Y" should never be left in place.
  const trimmed = u.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}
