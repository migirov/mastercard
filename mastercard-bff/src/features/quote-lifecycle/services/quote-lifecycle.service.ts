import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import { ConfirmationDto } from '../dto/confirmation.dto';
import { RetrieveQuoteQueryDto } from '../dto/retrieve-quote-query.dto';

/** A quote proposal after a state transition (confirm / cancel). */
export interface QuoteStateResponse {
  transactionReference: string;
  proposalId: string;
  state: string;
  expiresAt: string;
  source: Source;
}

/** A retrieved quote proposal, with best-effort pricing pulled from the opaque payload. */
export interface RetrievedQuoteResponse {
  transactionReference: string;
  proposalId: string;
  state: string;
  fxRate?: number;
  chargedAmount?: string;
  currency?: string;
  expiresAt: string;
  source: Source;
}

/**
 * Quote-lifecycle: confirm / cancel / retrieve a quote proposal. Mirrors the other
 * Features area services — `live` proxies to the cross-border gateway, `demo` synthesizes
 * a deterministic stand-in; `liveOrDemo` keeps the mode-check + graceful fall-back in one
 * place. Sandbox does not surface these endpoints yet, so the capability defaults to demo.
 */
@Injectable()
export class QuoteLifecycleService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /** Confirm a proposal → `CONFIRMED`. Live POSTs to the gateway; demo synthesizes. */
  async confirm(body: ConfirmationDto): Promise<QuoteStateResponse> {
    return liveOrDemo<QuoteStateResponse>(
      this.cfg.featureMode('quoteLifecycle') === 'live',
      async () => {
        const res = await this.gw.call({
          method: 'POST',
          path: '/crossborder/quotes/confirmations',
          body: {
            transactionReference: body.transactionReference,
            proposalId: body.proposalId,
          },
        });
        if (!res.ok) return undefined;
        return {
          transactionReference: body.transactionReference,
          proposalId: body.proposalId,
          state: 'CONFIRMED',
          expiresAt: expiry(),
          source: 'live',
        };
      },
      () => ({
        transactionReference: body.transactionReference,
        proposalId: body.proposalId,
        state: 'CONFIRMED',
        expiresAt: expiry(),
        source: 'demo',
      }),
    );
  }

  /** Cancel a proposal → `CANCELLED`. Live POSTs to the gateway; demo synthesizes. */
  async cancel(body: ConfirmationDto): Promise<QuoteStateResponse> {
    return liveOrDemo<QuoteStateResponse>(
      this.cfg.featureMode('quoteLifecycle') === 'live',
      async () => {
        const res = await this.gw.call({
          method: 'POST',
          path: '/crossborder/quotes/cancellations',
          body: {
            transactionReference: body.transactionReference,
            proposalId: body.proposalId,
          },
        });
        if (!res.ok) return undefined;
        return {
          transactionReference: body.transactionReference,
          proposalId: body.proposalId,
          state: 'CANCELLED',
          expiresAt: expiry(),
          source: 'live',
        };
      },
      () => ({
        transactionReference: body.transactionReference,
        proposalId: body.proposalId,
        state: 'CANCELLED',
        expiresAt: expiry(),
        source: 'demo',
      }),
    );
  }

  /**
   * Retrieve a stored proposal. Live GETs the gateway and maps the OPAQUE payload
   * best-effort (`quote_fx_rate` / `charged_amount` when present); demo synthesizes a
   * confirmed proposal with deterministic pricing.
   */
  async retrieve(q: RetrieveQuoteQueryDto): Promise<RetrievedQuoteResponse> {
    return liveOrDemo<RetrievedQuoteResponse>(
      this.cfg.featureMode('quoteLifecycle') === 'live',
      async () => {
        const res = await this.gw.call({
          method: 'GET',
          path: `/crossborder/quotes/${encodeURIComponent(
            q.transactionReference,
          )}/proposals/${encodeURIComponent(q.proposalId)}`,
        });
        if (!res.ok) return undefined;
        const fxRaw = asString(pick(res.data, 'quote_fx_rate'));
        const fx = fxRaw === undefined ? undefined : Number(fxRaw);
        const fxRate = fx !== undefined && Number.isFinite(fx) ? fx : undefined;
        return {
          transactionReference: q.transactionReference,
          proposalId: q.proposalId,
          state: asString(pick(res.data, 'status')) ?? 'CONFIRMED',
          fxRate,
          chargedAmount: asString(pick(res.data, 'charged_amount')),
          currency: asString(pick(res.data, 'charged_currency')),
          expiresAt: expiry(),
          source: 'live',
        };
      },
      () => ({
        transactionReference: q.transactionReference,
        proposalId: q.proposalId,
        state: 'CONFIRMED',
        fxRate: 3.7,
        chargedAmount: '110.41',
        currency: 'USD',
        expiresAt: expiry(),
        source: 'demo',
      }),
    );
  }
}

/** Proposal expiry: 15 minutes out, ISO-8601. Runtime `Date.now()` is allowed here. */
function expiry(): string {
  return new Date(Date.now() + 15 * 60_000).toISOString();
}
