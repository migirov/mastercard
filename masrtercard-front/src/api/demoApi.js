// Thin fetch wrapper around the demo BFF. The base URL comes from VITE_DEMO_API_URL
// (injected at build time by docker-compose); falls back to localhost for `npm run dev`.
const BASE = (import.meta.env.VITE_DEMO_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

async function req(method, path, { body, isForm } = {}) {
  const opts = { method, headers: {} };
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
