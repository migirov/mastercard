import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { sha256hex } from '../../../common/utils/crypto.util';
import { TransactionStatusStore } from '../../../webhooks/services/transaction-status.store';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { TransactionOwnership } from '../../common/ownership/transaction-ownership.service';
import { PaymentIdempotencyStore } from './payment-idempotency.store';
import { PaymentsService } from './payments.service';

const PID = 'SANDBOX_1234567';
const creds = { partnerId: PID } as McCredentials;
const activeTenant = {
  id: 'acme',
  credentialMode: 'PLATFORM',
  platformApproved: true,
  mcApproved: true,
  suspended: false,
} as unknown as Tenant;

function make(opts?: {
  tenant?: Tenant;
  owns?: boolean;
  paid?: boolean;
  /** The Mastercard edge this deployment talks to — folded into the fingerprint. */
  upstreamHost?: string;
  /** The tenant's partner-id — also folded into the fingerprint. */
  partnerId?: string;
}) {
  const client = {
    request: jest.fn(
      async (): Promise<{ status: number; data: unknown }> => ({
        status: 200,
        data: { ok: true },
      }),
    ),
    // MUST be present: `PaymentsService` folds the edge identity into the body
    // fingerprint via `gw.upstreamHost()`. A stub without it returns `undefined`,
    // JSON.stringify drops the key, and every fingerprint assertion silently runs
    // with the identity contribution absent — testing the code as it was BEFORE
    // the fold was added.
    upstreamHost: opts?.upstreamHost ?? 'sandbox.api.mastercard.com',
  };
  const registry = { get: jest.fn(async () => opts?.tenant ?? activeTenant) };
  const credentials = {
    resolve: jest.fn(async () => ({
      ...creds,
      ...(opts?.partnerId ? { partnerId: opts.partnerId } : {}),
    })),
  };
  const idempotency = {
    run: jest.fn(
      (_t: string, _k: string | undefined, producer: () => unknown) =>
        producer(),
    ),
  };
  const statusEvents = { findForTenant: jest.fn(async () => []) };
  const owns = opts?.owns ?? true;
  // `paid` (a completed payment) defaults to `owns`; set it independently to model a tenant
  // that holds only a QUOTE claim (owns=true, paid=false) — which must NOT unlock the pool.
  const paid = opts?.paid ?? owns;
  const ownership = {
    refHash: jest.fn((ref: string) => sha256hex(ref)),
    hasClaim: jest.fn(async () => owns),
    hasCompletedClaim: jest.fn(async () => paid),
    claim: jest.fn(async () => undefined),
    recordPayment: jest.fn(async () => undefined),
    assertOwnsRef: jest.fn(async () => {
      if (!owns) throw new NotFoundException();
    }),
    assertOwnsPaymentId: jest.fn(async () => {
      if (!owns) throw new NotFoundException();
    }),
  };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  const svc = new PaymentsService(
    gw,
    idempotency as unknown as PaymentIdempotencyStore,
    statusEvents as unknown as TransactionStatusStore,
    ownership as unknown as TransactionOwnership,
  );
  return { svc, client, idempotency, statusEvents, ownership };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

describe('PaymentsService — path & idempotency', () => {
  it('createPayment → /send/v1/.../payment', async () => {
    const { svc, client } = make();
    await svc.createPayment('acme', {} as never);
    expect(reqOf(client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/payment`,
    );
  });

  it('createPayment — idempotency key = txref:sha256(transaction_reference)', async () => {
    const { svc, idempotency } = make();
    const ref = '08POC342598033X';
    await svc.createPayment('acme', {
      paymentrequest: { transaction_reference: ref },
    } as never);
    const call = idempotency.run.mock.calls[0];
    expect(call[0]).toBe('acme');
    expect(call[1]).toBe(`txref:${sha256hex(ref)}`);
  });

  it('createPayment without transaction_reference → key undefined (no idempotency)', async () => {
    const { svc, idempotency } = make();
    await svc.createPayment('acme', {} as never);
    expect(idempotency.run.mock.calls[0][1]).toBeUndefined();
  });

  it('fingerprint is canonical — key-reordered identical bodies hash the same (replay, not 422)', async () => {
    const fp = (idem: { run: jest.Mock }) =>
      idem.run.mock.calls[0][3] as string;

    const a = make();
    await a.svc.createPayment('acme', {
      paymentrequest: {
        transaction_reference: 'TX',
        payment_amount: { amount: '10', currency: 'USD' },
      },
    } as never);

    const b = make();
    await b.svc.createPayment('acme', {
      paymentrequest: {
        payment_amount: { currency: 'USD', amount: '10' },
        transaction_reference: 'TX',
      },
    } as never);

    expect(fp(a.idempotency)).toBe(fp(b.idempotency));

    // a genuinely different payment (different amount) still produces a different fingerprint
    const c = make();
    await c.svc.createPayment('acme', {
      paymentrequest: {
        transaction_reference: 'TX',
        payment_amount: { amount: '11', currency: 'USD' },
      },
    } as never);
    expect(fp(c.idempotency)).not.toBe(fp(a.idempotency));
  });

  /**
   * The fingerprint also binds the Mastercard IDENTITY the payment was made under.
   *
   * A `done` idempotency row lives forever and replays without calling Mastercard.
   * Without this, a payment submitted against one edge (or one partner account) and
   * retried after the deployment was repointed would return the FIRST edge's stored
   * response for a payment that does not exist on the second — a silent wrong answer
   * about money. With it, the mismatch is a loud 422 instead.
   */
  it('the same body under a different Mastercard identity is a DIFFERENT fingerprint', async () => {
    const fp = (idem: { run: jest.Mock }) =>
      idem.run.mock.calls[0][3] as string;
    const body = {
      paymentrequest: {
        transaction_reference: 'TX',
        payment_amount: { amount: '10', currency: 'USD' },
      },
    } as never;

    const base = make();
    await base.svc.createPayment('acme', body);

    // Same body, different edge (the .com -> PSD2 repoint).
    const otherEdge = make({ upstreamHost: 'sandbox.api.xbs.mastercard.eu' });
    await otherEdge.svc.createPayment('acme', body);
    expect(fp(otherEdge.idempotency)).not.toBe(fp(base.idempotency));

    // Same body, same edge, different partner account.
    const otherPartner = make({ partnerId: 'OTHER_PARTNER' });
    await otherPartner.svc.createPayment('acme', body);
    expect(fp(otherPartner.idempotency)).not.toBe(fp(base.idempotency));

    // And unchanged identity still replays rather than 422-ing.
    const same = make();
    await same.svc.createPayment('acme', body);
    expect(fp(same.idempotency)).toBe(fp(base.idempotency));
  });

  it('id in the path — encodeURIComponent (anti structural injection)', async () => {
    const { svc, client } = make();
    await svc.getPayment('acme', 'a b/c');
    expect(reqOf(client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/${encodeURIComponent('a b/c')}`,
    );
  });

  it('getPaymentByRef → GET /send/v1/.../crossborder?ref={ref} (ref encoded)', async () => {
    const { svc, client } = make();
    await svc.getPaymentByRef('acme', 'a b/c');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/v1/partners/${PID}/crossborder?ref=${encodeURIComponent('a b/c')}`,
    });
  });

  it('cancelPayment → POST /send/v1/.../{id}/cancel (id encoded)', async () => {
    const { svc, client } = make();
    await svc.cancelPayment('acme', 'a b/c');
    expect(reqOf(client)).toMatchObject({
      method: 'POST',
      path: `/send/v1/partners/${PID}/crossborder/${encodeURIComponent('a b/c')}/cancel`,
    });
  });
});

describe('PaymentsService — ownership gating (PLATFORM tenants share one MC partner)', () => {
  // Without a claim these are exactly the cross-tenant reads/cancels F2 describes: the id or
  // ref alone resolves to the shared partner account, so MC would answer for a peer.
  it.each([
    ['getPaymentByRef', (s: PaymentsService) => s.getPaymentByRef('acme', 'R')],
    ['getPayment', (s: PaymentsService) => s.getPayment('acme', 'rem_x')],
    ['cancelPayment', (s: PaymentsService) => s.cancelPayment('acme', 'rem_x')],
  ])('%s without a claim → rejected, MC is NOT called', async (_n, call) => {
    const { svc, client } = make({ owns: false });
    await expect(call(svc)).rejects.toBeInstanceOf(NotFoundException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('createPayment records ownership with the extracted MC payment id', async () => {
    const { svc, client, ownership } = make();
    client.request.mockResolvedValue({
      status: 201,
      data: { payment: { id: 'rem_abc' } },
    });
    await svc.createPayment('acme', {
      paymentrequest: { transaction_reference: 'TX' },
    } as never);
    expect(ownership.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme' }),
      'TX',
      'rem_abc',
    );
  });

  it('createPayment still succeeds when ownership bookkeeping fails', async () => {
    const { svc, ownership } = make();
    ownership.recordPayment.mockRejectedValue(new Error('db down'));
    await expect(
      svc.createPayment('acme', {
        paymentrequest: { transaction_reference: 'TX' },
      } as never),
    ).resolves.toEqual({ ok: true });
  });
});

describe('PaymentsService — status events (local read)', () => {
  const ownTenant = {
    id: 'own-1',
    credentialMode: 'OWN',
    platformApproved: true,
    mcApproved: true,
    suspended: false,
  } as unknown as Tenant;

  it('OWN → findForTenant(id, ref, includePool=false); maps to view (no id/tenantId); MC is not called', async () => {
    const rows = [
      {
        id: 1,
        tenantId: 'own-1',
        transactionReference: 'TX1',
        eventType: 'STATUS_CHG',
        transactionType: 'PAYMENT',
        status: 'CONFIRMED',
        stage: null,
        receivedAt: new Date(0),
        payload: { a: 1 },
      },
    ];
    const { svc, statusEvents, client, ownership } = make({
      tenant: ownTenant,
    });
    (statusEvents.findForTenant as jest.Mock).mockResolvedValue(rows);
    const out = await svc.getStatusEvents('own-1', 'TX1');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'own-1',
      'TX1',
      false,
    );
    // OWN never reads the pool — no ownership check needed.
    expect(ownership.hasCompletedClaim).not.toHaveBeenCalled();
    expect(out).toEqual([
      {
        transactionReference: 'TX1',
        eventType: 'STATUS_CHG',
        transactionType: 'PAYMENT',
        status: 'CONFIRMED',
        stage: null,
        receivedAt: new Date(0),
        payload: { a: 1 },
      },
    ]);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('PLATFORM + completed a payment on the ref → includePool=true (reads the shared null pool)', async () => {
    const { svc, statusEvents, ownership } = make({ owns: true, paid: true });
    await svc.getStatusEvents('acme', 'TX2');
    expect(ownership.hasCompletedClaim).toHaveBeenCalledWith('acme', 'TX2');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      true,
    );
  });

  it('PLATFORM + only a QUOTE claim (no completed payment) → includePool=false (a quote must not unlock the pool)', async () => {
    const { svc, statusEvents, ownership } = make({ owns: true, paid: false });
    await svc.getStatusEvents('acme', 'TX2');
    expect(ownership.hasCompletedClaim).toHaveBeenCalledWith('acme', 'TX2');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      false,
    );
  });

  it('PLATFORM + does NOT own the ref → includePool=false (no cross-tenant pool read)', async () => {
    const { svc, statusEvents } = make({ owns: false });
    await svc.getStatusEvents('acme', 'TX2');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      false,
    );
  });

  // F12a: this is the one crossborder route that never reaches the gateway's own gate,
  // so a suspended tenant would otherwise keep reading until its 15-minute JWT expired.
  it('a SUSPENDED tenant is refused (the route re-reads the tenant, not the auth snapshot)', async () => {
    const suspended = { ...ownTenant, suspended: true } as Tenant;
    const { svc, statusEvents } = make({ tenant: suspended });
    await expect(svc.getStatusEvents('own-1', 'TX1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(statusEvents.findForTenant).not.toHaveBeenCalled();
  });

  // Reading one's own history is not transacting. A tenant awaiting dual approval is blocked
  // from every MC-bound route by resolveActive, but must not lose sight of transactions it
  // already made — so this route checks suspension only, not full activeness.
  it('a PENDING (not yet dual-approved) tenant may still read its own history', async () => {
    const pending = {
      ...ownTenant,
      platformApproved: false,
      mcApproved: false,
    } as Tenant;
    const { svc, statusEvents } = make({ tenant: pending });
    await expect(svc.getStatusEvents('own-1', 'TX1')).resolves.toEqual([]);
    expect(statusEvents.findForTenant).toHaveBeenCalled();
  });
});
