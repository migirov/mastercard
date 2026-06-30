/**
 * The shared live|demo orchestration every XBS area service uses: when the capability is in
 * `live` mode, attempt the real gateway call (`tryLive`) and use it if it returned a usable
 * result; on any miss — or in `demo` mode — fall back to the synthesized `demo` value. Keeps
 * the mode-check + graceful-fallback in ONE place instead of being re-implemented per service.
 */
export async function liveOrDemo<T>(
  isLive: boolean,
  tryLive: () => Promise<T | undefined>,
  demo: () => T,
): Promise<T> {
  if (isLive) {
    const live = await tryLive();
    if (live !== undefined) return live;
  }
  return demo();
}
