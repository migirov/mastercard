// Storage for the access-gate proof.
//
// The proof is an HMAC-signed value app-bff hands out when the gate password checks out; both BFFs
// demand it in `X-XBS-Gate` on every request. It is held in sessionStorage and sent as a header
// rather than kept in a cookie: a header is not an ambient credential, so it carries no CSRF
// surface and needs no `credentials` handling anywhere. It is not secret from the person using the
// tab — it is unforgeable, which is the property that matters.
//
// IMPORTANT: this module must NOT import ./demoApi. demoApi imports THIS module, and a cycle would
// leave demoApi's BASE/TOKEN undefined, because both are computed at module-evaluation time (see
// the note in index.html about /config.js loading before the bundle).

const PROOF_KEY = 'xbs_gate_proof';

// Every accessor is wrapped: sessionStorage throws outright in Safari private mode and under
// hardened privacy settings, the same reason PasswordGate guards its own reads.
export function getProof() {
  try {
    return sessionStorage.getItem(PROOF_KEY) || '';
  } catch {
    return '';
  }
}

export function setProof(proof) {
  try {
    sessionStorage.setItem(PROOF_KEY, proof);
  } catch {
    /* private mode — the proof just won't survive a reload */
  }
}

export function clearProof() {
  try {
    sessionStorage.removeItem(PROOF_KEY);
  } catch {
    /* nothing to do — if we cannot read it, we cannot have stored it either */
  }
}

/**
 * Is there a proof that has not expired yet?
 *
 * Reads the expiry out of the proof's middle segment (`v1.<epochSeconds>.<signature>`), which the
 * server put there precisely so the SPA can decide whether to show the gate on load with no
 * round-trip. This is a UX shortcut ONLY: the expiry is also signed, and the servers are what
 * actually enforce it — a user editing this value gains nothing but a 401.
 */
export function hasLiveProof() {
  const proof = getProof();
  if (!proof) return false;
  const parts = proof.split('.');
  if (parts.length !== 3) return false;
  const expirySeconds = Number(parts[1]);
  if (!Number.isFinite(expirySeconds)) return false;
  return expirySeconds * 1000 > Date.now();
}
