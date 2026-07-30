// Access-gate client.
//
// The gate password is checked SERVER-SIDE by app-bff (`POST /demo-api/gate/verify`, which nginx
// rewrites to `/gate/verify`). It deliberately does not exist in this bundle in any form: it used
// to be a module-level constant in `components/PasswordGate.jsx`, which Vite inlined into
// `dist/assets/index-*.js` — so it shipped inside the published image and was readable by anyone
// who could load the app.
import { demoApi } from './demoApi';

/**
 * Verify a typed password.
 *
 * Returns a discriminator instead of throwing, so the caller has no `try/catch` and therefore no
 * way to collapse these four outcomes into one "something went wrong" — which is exactly what the
 * old gate did, and why a stopped backend used to be reported as a wrong password.
 *
 * On success the server also returns the signed proof that both BFFs require on every subsequent
 * request; `status: 'ok'` always carries one.
 *
 * @param {string} password
 * @returns {Promise<{ status: 'ok', proof: string, expiresAt: number }
 *                 | { status: 'bad-password'|'rate-limited'|'unavailable' }>}
 */
export async function verifyGatePassword(password) {
  try {
    const res = await demoApi.post('/gate/verify', { password });
    return {
      status: 'ok',
      proof: res?.proof ?? '',
      expiresAt: res?.expiresAt ?? 0,
    };
  } catch (err) {
    const status = /** @type {any} */ (err)?.status;
    if (status === 401) return { status: 'bad-password' };
    if (status === 429) return { status: 'rate-limited' };
    // Everything else: 5xx, a 502 from nginx when app-bff is down, a 400 from a client bug, or a
    // rejected fetch with no status at all. All of them mean "not the user's fault".
    return { status: 'unavailable' };
  }
}
