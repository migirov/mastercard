/// <reference types="vite/client" />
// Thin fetch wrapper around the demo BFF. The base URL comes from VITE_DEMO_API_URL
// (injected at build time by docker-compose); falls back to localhost for `npm run dev`.
// The reference above is what teaches `checkJs` about `import.meta.env` — jsconfig sets
// `"types": []`, so nothing is picked up implicitly.
const BASE = (import.meta.env.VITE_DEMO_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

// Shared bearer token for both BFFs, inlined at BUILD time like VITE_DEMO_API_URL.
//
// Being in the bundle means it is readable by anyone who can load the app — this is one trust
// boundary keeping the APIs off the open internet, NOT per-user authorization. Do not treat it
// as a user secret. Empty here → every call 401s, which is the intended failure: see the
// build-arg wiring in Dockerfile and docker-compose.yml.
const TOKEN = import.meta.env.VITE_DEMO_API_TOKEN ?? '';

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
    throw new Error(`demo-api ${method} ${path} → ${res.status} ${text}`);
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
