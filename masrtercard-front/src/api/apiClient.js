// App data client. Implements the small SDK surface the UI uses (entity CRUD, auth.me,
// integrations) against our own demo BFF (demoApi). Exported as `api`; cross-border payment
// operations live in ./xbs.
import { demoApi } from './demoApi';
import { clearProof } from './gateSession';

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
/**
 * Every string key resolves to a client, so the accurate type is an index signature — without
 * it the target `{}` is what TS sees, and each `api.entities.Invoice` is an error whose fallout
 * spreads into any `useMutation` built on top of it.
 * @type {Record<string, ReturnType<typeof entityClient>>}
 */
const entities = new Proxy(
  {},
  { get: (_t, name) => (typeof name === 'string' ? entityClient(name) : undefined) },
);

/**
 * Drop everything that says "this session passed the gate", then reload.
 *
 * A reload with no proof and no flag re-renders `<PasswordGate>`, and the branded gate screen IS
 * the login page — so this needs no route and no router change. Clearing the PROOF is the part
 * that has teeth: without it the API calls would keep succeeding, since the servers never saw the
 * client-side flag in the first place.
 */
function endGateSession() {
  clearProof();
  try {
    sessionStorage.removeItem('xbs_access_granted');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.location.reload();
}

const auth = {
  me: () => demoApi.get('/auth/me'),
  // The demo "login" is the PasswordGate, verified server-side; logging out drops the proof it
  // obtained, so the next request genuinely fails rather than merely looking logged out.
  logout: async () => endGateSession(),
  // No longer a no-op. Reached when a proof expires mid-session (12 h default): the API answers
  // 401 gate_required, demoApi has already discarded the dead proof, and this returns the user to
  // the gate instead of leaving an app in which every panel silently errors.
  redirectToLogin: () => endGateSession(),
};

const integrations = {
  Core: {
    InvokeLLM: async (args) => {
      const r = await demoApi.post('/integrations/invoke-llm', {
        prompt: args?.prompt ?? '',
      });
      return r?.response ?? r;
    },
    /** @param {any} args */
    UploadFile: async ({ file } = {}) => {
      const form = new FormData();
      if (file) form.append('file', file);
      return demoApi.postForm('/integrations/upload-file', form);
    },
  },
};

export const api = { entities, auth, integrations };
