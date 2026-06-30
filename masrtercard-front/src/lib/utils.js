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
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u : null;
}
