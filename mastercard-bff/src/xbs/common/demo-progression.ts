/**
 * The deterministic demo progression a payment/transaction walks through — the SINGLE source
 * of truth shared by the `status` (xbs) and `payment-tracker` (features) area services, which
 * both synthesize the same pending→processing→completed timeline in `demo` mode.
 *
 * It is anchored to a fixed module-load epoch (NOT "now"), so a given ref genuinely advances
 * through the stages as wall-clock time passes — rather than freezing at its stage on each call
 * — WITHOUT any persistence. A per-ref hash staggers refs so they don't all sit at one stage.
 */

/** One step of the progression: a status, its sub-stage, and when it occurred. The synthesized
 *  demo path always sets `stage`; a live-mapped entry may omit it — hence optional. */
export interface ProgressionEntry {
  status: string;
  stage?: string;
  timestamp: string;
}

const STAGES: ReadonlyArray<{ status: string; stage: string }> = [
  { status: 'pending', stage: 'received' },
  { status: 'processing', stage: 'screening' },
  { status: 'processing', stage: 'in_network' },
  { status: 'completed', stage: 'settled' },
];

/** Minutes per stage — repeated look-ups of the same ref advance over time. */
const MINUTES_PER_STAGE = 1;

/**
 * Captured ONCE at module load (server start). The progression is anchored to this fixed epoch
 * (not `Date.now()` per call), so the same ref keeps the same absolute start and elapsed
 * wall-clock grows — making it advance through the stages instead of freezing.
 */
const SERVER_EPOCH = Date.now();

/** A stable per-ref "started at": a deterministic offset (hashed from the ref) before `SERVER_EPOCH`. */
function startTime(ref: string): number {
  let h = 0;
  for (let i = 0; i < ref.length; i++) {
    h = (h * 31 + ref.charCodeAt(i)) | 0;
  }
  const spanMs = STAGES.length * MINUTES_PER_STAGE * 60_000;
  const offset = Math.abs(h) % spanMs;
  return SERVER_EPOCH - offset;
}

/**
 * Deterministic, time-derived progression for a ref: its current status/stage plus the history
 * up to it. Repeated calls for the same ref advance as wall-clock time passes (no persistence).
 */
export function synthesizeProgression(ref: string): {
  status: string;
  stage: string;
  history: ProgressionEntry[];
} {
  const startedAt = startTime(ref);
  const elapsedMin = (Date.now() - startedAt) / 60_000;
  const reached = Math.min(
    STAGES.length - 1,
    Math.max(0, Math.floor(elapsedMin / MINUTES_PER_STAGE)),
  );

  const history: ProgressionEntry[] = [];
  for (let i = 0; i <= reached; i++) {
    history.push({
      status: STAGES[i].status,
      stage: STAGES[i].stage,
      timestamp: new Date(
        startedAt + i * MINUTES_PER_STAGE * 60_000,
      ).toISOString(),
    });
  }
  const current = STAGES[reached];
  return { status: current.status, stage: current.stage, history };
}
