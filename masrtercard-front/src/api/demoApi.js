/// <reference types="vite/client" />
// Thin fetch wrapper around the demo BFF.
//
// Configuration is read at RUNTIME from `window.__XBS_CONFIG__`, which the container's
// entrypoint writes to `/config.js` from its environment before nginx starts (index.html loads
// that file ahead of the bundle). Baking these into the bundle at build time instead would tie
// one image to one deployment's token — the published image must be environment-agnostic, so
// an operator can set the token at `docker run` time and no secret ever enters an image layer.
//
// The `import.meta.env` fallbacks keep `npm run dev` working (Vite serves the `public/config.js`
// stub, which sets no values). The reference above is what teaches `checkJs` about
// `import.meta.env` — jsconfig sets `"types": []`, so nothing is picked up implicitly.
import { clearProof, getProof, hasLiveProof } from './gateSession';

const RUNTIME = /** @type {any} */ (globalThis).__XBS_CONFIG__ ?? {};

const BASE = (
  RUNTIME.apiUrl ||
  import.meta.env.VITE_DEMO_API_URL ||
  'http://localhost:4000'
).replace(/\/+$/, '');

// Shared bearer token for both BFFs.
//
// Reaching the browser means it is readable by anyone who can load the app — and by anyone who
// simply fetches /config.js. So it is NOT per-user authorization and NOT a user secret, and on its
// own it is not sufficient either: both BFFs require a second factor, the gate proof below, which
// is minted only against DEMO_GATE_PASSWORD server-side and cannot be forged from anything the
// browser holds. What the token still does is keep the APIs off the open internet.
// Empty here → every call 401s, which is the intended failure: see the entrypoint wiring in
// Dockerfile and docker-compose.yml.
const TOKEN = RUNTIME.apiToken || import.meta.env.VITE_DEMO_API_TOKEN || '';

/**
 * @param {string} method
 * @param {string} path
 * @param {any} [init]
 */
async function req(method, path, { body, isForm } = {}) {
  /** @type {any} */
  const opts = { method, headers: {} };
  // Set before the isForm branch so uploads carry it too, and never touch Content-Type —
  // FormData bodies need the browser to set their own multipart boundary.
  if (TOKEN) opts.headers.Authorization = `Bearer ${TOKEN}`;
  // The gate proof, the SECOND factor both BFFs require. Set here for exactly the same reason as
  // the line above: the RFI document upload is a FormData call, and a proof attached inside the
  // isForm branch would be missing from it.
  const proof = getProof();
  if (proof) opts.headers['X-XBS-Gate'] = proof;
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData — let the browser set the multipart boundary
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // The status is attached as a PROPERTY, not just interpolated into the message. The gate
    // screen has to tell "wrong password" (401) from "rate-limited" (429) from "backend down"
    // (5xx / network), and string-matching a human-readable message for that would be fragile.
    // The message format is unchanged, so every existing call site behaves exactly as before.
    // Note a `fetch` REJECTION (DNS failure, connection refused, CSP block) throws a TypeError
    // with no `.status` at all — which is itself the "unreachable" signal.
    // A DEAD proof cleans itself up, so the app stops re-sending a value that can never succeed:
    // the next reload shows the gate screen (readGranted also checks hasLiveProof).
    //
    // The `!hasLiveProof()` condition is what keeps this narrow, and it matters. A `gate_required`
    // 401 has two very different causes, and the expiry — which we can check locally — is what
    // separates them:
    //   - the proof has expired            → discard it; the user must retype the password.
    //   - the proof is still live but one service rejected it → the two BFFs' DEMO_GATE_SECRET
    //     values have drifted. Discarding here would take down the service that still ACCEPTS the
    //     proof as well, converting a partial, diagnosable failure (cross-border pages 401, the
    //     dashboard fine) into a total one. Leave it; let the 401s point at the real cause.
    if (res.status === 401 && text.includes('gate_required') && !hasLiveProof()) {
      clearProof();
    }
    const err = /** @type {Error & { status?: number, body?: string }} */ (
      new Error(`demo-api ${method} ${path} → ${res.status} ${text}`)
    );
    err.status = res.status;
    err.body = text;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const demoApi = {
  base: BASE,
  get: (p) => req('GET', p),
  post: (p, body) => req('POST', p, { body }),
  put: (p, body) => req('PUT', p, { body }),
  patch: (p, body) => req('PATCH', p, { body }),
  del: (p) => req('DELETE', p),
  postForm: (p, form) => req('POST', p, { body: form, isForm: true }),
};
