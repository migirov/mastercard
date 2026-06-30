import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import {
  ProgressionEntry,
  synthesizeProgression,
} from '../../../xbs/common/demo-progression';

/** One step in a payment's tracked progression. */
export type TrackHistoryEntry = ProgressionEntry;

/** A payment's current status plus the history that led to it. */
export interface TrackResponse {
  ref: string;
  status: string;
  stage?: string;
  history: TrackHistoryEntry[];
  source: Source;
}

/** The outcome of a cancellation request. */
export interface CancelResponse {
  id: string;
  state: string;
  source: Source;
}

/**
 * Payment Tracker: look up a payment's status/history by reference, and cancel a payment by
 * id. Mirrors the other Features area services — `live` proxies to the cross-border gateway,
 * `demo` synthesizes a deterministic stand-in; `liveOrDemo` keeps the mode-check + graceful
 * fall-back in one place. Sandbox does not surface these endpoints yet, so the capability
 * defaults to demo.
 */
@Injectable()
export class PaymentTrackerService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /**
   * Track a payment by reference. `live` → read the payment from the gateway
   * (`GET /crossborder/payments?ref=`) and map the opaque MC JSON best-effort; fall back to
   * demo on error. `demo` → a deterministic time-derived progression: a stable per-ref start
   * time (hashed from the ref) plus the elapsed wall-clock advances pending→processing→
   * completed, so repeated look-ups of the same ref progress WITHOUT any persistence.
   */
  async track(ref: string): Promise<TrackResponse> {
    return liveOrDemo(
      this.cfg.featureMode('paymentTracker') === 'live',
      () => this.tryLiveTrack(ref),
      () => this.synthesize(ref),
    );
  }

  private async tryLiveTrack(ref: string): Promise<TrackResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: '/crossborder/payments',
      query: { ref },
    });
    if (!res.ok) return undefined;

    // Opaque MC payment JSON — pull a status string if one is present, else treat as a miss.
    const status =
      asString(pick(res.data, 'status')) ??
      asString(pick(res.data, 'state')) ??
      asString(pick(res.data, 'payment_status'));
    if (status === undefined) return undefined;

    const stage = asString(pick(res.data, 'stage'));
    const timestamp =
      asString(pick(res.data, 'receivedAt')) ??
      asString(pick(res.data, 'timestamp')) ??
      new Date().toISOString();
    return {
      ref,
      status,
      stage,
      history: [{ status, stage, timestamp }],
      source: 'live',
    };
  }

  /** Deterministic time-derived progression for the ref (shared `demo-progression` engine). */
  private synthesize(ref: string): TrackResponse {
    const p = synthesizeProgression(ref);
    return {
      ref,
      status: p.status,
      stage: p.stage,
      history: p.history,
      source: 'demo',
    };
  }

  /**
   * Cancel a payment by id → `CANCELLED`. `live` POSTs to the gateway
   * (`/crossborder/payments/{id}/cancel`); demo synthesizes the cancelled state.
   */
  async cancel(id: string): Promise<CancelResponse> {
    return liveOrDemo(
      this.cfg.featureMode('paymentTracker') === 'live',
      () => this.tryLiveCancel(id),
      () => ({ id, state: 'CANCELLED', source: 'demo' }),
    );
  }

  private async tryLiveCancel(id: string): Promise<CancelResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: `/crossborder/payments/${encodeURIComponent(id)}/cancel`,
    });
    if (!res.ok) return undefined;
    return { id, state: 'CANCELLED', source: 'live' };
  }
}
