// App data client. Implements the small SDK surface the UI uses (entity CRUD, auth.me,
// integrations) against our own demo BFF (demoApi). Exported as `api`; cross-border payment
// operations live in ./xbs.
import { demoApi } from './demoApi';

const enc = encodeURIComponent;

/** `api.entities.<Name>` — list/get/create/update/delete (+ a client-side filter). */
function entityClient(name) {
  const client = {
    list: (sort, limit) => {
      const qs = new URLSearchParams();
      if (sort) qs.set('sort', sort);
      if (limit != null) qs.set('limit', String(limit));
      const s = qs.toString();
      return demoApi.get(`/entities/${enc(name)}${s ? `?${s}` : ''}`);
    },
    // filter is unused by the app; emulate via list + client-side match for safety.
    filter: async (query = {}, sort, limit) => {
      const all = await client.list(sort, limit);
      return all.filter((r) =>
        Object.entries(query).every(([k, v]) => r[k] === v),
      );
    },
    get: (id) => demoApi.get(`/entities/${enc(name)}/${enc(id)}`),
    create: (data) => demoApi.post(`/entities/${enc(name)}`, data ?? {}),
    update: (id, data) =>
      demoApi.put(`/entities/${enc(name)}/${enc(id)}`, data ?? {}),
    delete: (id) => demoApi.del(`/entities/${enc(name)}/${enc(id)}`),
  };
  return client;
}

// A Proxy so `api.entities.Invoice` and dynamic `api.entities[name]` both resolve.
const entities = new Proxy(
  {},
  { get: (_t, name) => (typeof name === 'string' ? entityClient(name) : undefined) },
);

const auth = {
  me: () => demoApi.get('/auth/me'),
  // The demo "login" is the client-side PasswordGate; logging out clears it and reloads.
  logout: async () => {
    try {
      sessionStorage.removeItem('xbs_access_granted');
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') window.location.reload();
  },
  redirectToLogin: () => {
    /* no-op: auth is not required in the demo */
  },
};

const integrations = {
  Core: {
    InvokeLLM: async (args) => {
      const r = await demoApi.post('/integrations/invoke-llm', {
        prompt: args?.prompt ?? '',
      });
      return r?.response ?? r;
    },
    UploadFile: async ({ file } = {}) => {
      const form = new FormData();
      if (file) form.append('file', file);
      return demoApi.postForm('/integrations/upload-file', form);
    },
  },
};

export const api = { entities, auth, integrations };
