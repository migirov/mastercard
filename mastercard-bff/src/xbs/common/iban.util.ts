/**
 * IBAN checking for the DEMO fallback path.
 *
 * This is what answers when a `live` Mastercard validation cannot be reached, so what it
 * reports is what an operator sees under the "Validated" badge. A structural regex alone was
 * not good enough for that job: it accepts `XX00` followed by any 11–30 alphanumerics, i.e.
 * it called a made-up account valid. Adding the ISO 13616 mod-97 checksum makes the demo
 * answer mean something without any dependency or network call.
 *
 * It remains a CHECKSUM, not an existence check — a well-formed IBAN for a closed or
 * non-existent account still passes. Only Mastercard can answer the real question, which is
 * exactly why the UI must distinguish a live answer from this one.
 */

/** Structural sanity: 2-letter country + 2 check digits + 11–30 alphanumerics. */
export const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/** Strip all whitespace and upper-case — IBANs are conventionally written in groups of 4. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** Structurally well-formed AND the ISO 13616 checksum holds. */
export function isValidIban(normalized: string): boolean {
  if (!IBAN_RE.test(normalized)) return false;
  return mod97(normalized) === 1;
}

/**
 * ISO 7064 MOD-97-10 over the rearranged IBAN: move the first four characters to the end,
 * map letters to numbers (A=10 … Z=35), then take the whole thing mod 97 — which must be 1.
 * Computed in chunks because the expanded value far exceeds Number.MAX_SAFE_INTEGER.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    // 'A'..'Z' → 10..35; '0'..'9' → 0..9. IBAN_RE has already excluded anything else.
    const part =
      code >= 65 && code <= 90 ? String(code - 55) : String.fromCharCode(code);
    for (const digit of part) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder;
}
