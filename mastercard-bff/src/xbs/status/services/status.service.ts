import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { Source } from '../../common/source';
import { liveOrDemo } from '../../common/live-or-demo';
import { asString, pick } from '../../common/parse.util';
import { synthesizeProgression } from '../../common/demo-progression';

export interface StatusHistoryEntry {
  status: string;
  stage?: string;
  timestamp: string;
}

export interface StatusResponse {
  ref: string;
  status: string;
  stage?: string;
  history: StatusHistoryEntry[];
  source: Source;
}

@Injectable()
export class StatusService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Payment status by reference. `live` → read stored push statuses from the gateway
   * (`/crossborder/status-events?ref=`) and project them; fall back to demo on error.
   * `demo` → a deterministic time-derived progression: a stable per-ref start time
   * (hashed from the ref) plus the elapsed wall-clock advances pending→processing→
   * completed, so repeated polls of the same ref progress WITHOUT any persistence.
   */
  async status(ref: string): Promise<StatusResponse> {
    return liveOrDemo(
      this.cfg.mode('status') === 'live',
      () => this.tryLive(ref),
      () => this.synthesize(ref, 'demo'),
    );
  }

  private async tryLive(ref: string): Promise<StatusResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: '/crossborder/status-events',
      query: { ref },
    });
    if (!res.ok) return undefined;

    // The gateway returns an array of stored status events (opaque MC fields).
    const events = Array.isArray(res.data)
      ? res.data
      : Array.isArray(pick(res.data, 'events'))
        ? (pick(res.data, 'events') as unknown[])
        : undefined;
    if (!events || events.length === 0) return undefined;

    const history: StatusHistoryEntry[] = events.map((e) => ({
      status: asString(pick(e, 'status')) ?? 'unknown',
      stage: asString(pick(e, 'stage')),
      timestamp:
        asString(pick(e, 'receivedAt')) ??
        asString(pick(e, 'timestamp')) ??
        new Date().toISOString(),
    }));
    const last = history[history.length - 1];
    return {
      ref,
      status: last.status,
      stage: last.stage,
      history,
      source: 'live',
    };
  }

  /** Deterministic time-derived progression for the ref (shared `demo-progression` engine). */
  private synthesize(ref: string, source: Source): StatusResponse {
    const p = synthesizeProgression(ref);
    return {
      ref,
      status: p.status,
      stage: p.stage,
      history: p.history,
      source,
    };
  }
}
