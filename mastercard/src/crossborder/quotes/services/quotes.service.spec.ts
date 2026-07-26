import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { NotFoundException } from '@nestjs/common';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { TransactionOwnership } from '../../common/ownership/transaction-ownership.service';
import { QuotesService } from './quotes.service';

const PID = 'SANDBOX_1234567';
const creds = { partnerId: PID } as McCredentials;
const activeTenant = {
  id: 'acme',
  credentialMode: 'PLATFORM',
  platformApproved: true,
  mcApproved: true,
  suspended: false,
} as unknown as Tenant;

function make(opts?: { owns?: boolean }) {
  const client = {
    request: jest.fn(async () => ({ status: 200, data: { ok: true } })),
  };
  const registry = { get: jest.fn(async () => activeTenant) };
  const credentials = { resolve: jest.fn(async () => creds) };
  const owns = opts?.owns ?? true;
  const ownership = {
    refHash: jest.fn((ref: string) => `h(${ref})`),
    claim: jest.fn(async () => undefined),
    assertOwnsRef: jest.fn(async () => {
      if (!owns) throw new NotFoundException();
    }),
  };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  const svc = new QuotesService(
    gw,
    ownership as unknown as TransactionOwnership,
  );
  return { svc, client, ownership };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

/** The gated methods now require a reference — supply one for the path-shape tests. */
const CONFIRM = { transactionReference: 'TX1', proposalId: 'pen_1' } as never;

describe('QuotesService — path construction', () => {
  it('createQuote → /send/v1/.../quotes', async () => {
    const { svc, client } = make();
    await svc.createQuote('acme', {} as never);
    expect(reqOf(client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/quotes`,
    );
  });

  it('confirm/cancel confirmed quote — POST .../quotes/{confirmations,cancellations}', async () => {
    const a = make();
    await a.svc.confirmQuote('acme', CONFIRM);
    expect(reqOf(a.client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/quotes/confirmations`,
    });
    const b = make();
    await b.svc.cancelConfirmedQuote('acme', CONFIRM);
    expect(reqOf(b.client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/quotes/cancellations`,
    });
  });

  it('retrieveConfirmedQuote — GET .../quotes/{ref}/proposals/{proposalId}, both segments are encoded', async () => {
    const { svc, client } = make();
    // both args carry chars that must be percent-encoded → proves BOTH segments
    // go through encodeURIComponent (not just proposalId).
    await svc.retrieveConfirmedQuote('acme', '40C 123', 'pen_4000 99');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/partners/${PID}/crossborder/quotes/${encodeURIComponent('40C 123')}/proposals/${encodeURIComponent('pen_4000 99')}`,
    });
  });
});

describe('QuotesService — ownership gating', () => {
  // createQuote is the CLAIM point: confirmations happen before any payment exists, so
  // gating them on a payment record would reject every legitimate confirmation.
  it('createQuote claims the reference AFTER MC accepts it', async () => {
    const { svc, ownership } = make();
    await svc.createQuote('acme', {
      quoterequest: { transaction_reference: 'TX9' },
    } as never);
    expect(ownership.claim).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme' }),
      'TX9',
    );
  });

  it('createQuote is NOT gated (it is where ownership begins)', async () => {
    const { svc, client, ownership } = make({ owns: false });
    await expect(
      svc.createQuote('acme', {
        quoterequest: { transaction_reference: 'TX9' },
      } as never),
    ).resolves.toEqual({ ok: true });
    expect(ownership.assertOwnsRef).not.toHaveBeenCalled();
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['confirmQuote', (s: QuotesService) => s.confirmQuote('acme', CONFIRM)],
    [
      'cancelConfirmedQuote',
      (s: QuotesService) => s.cancelConfirmedQuote('acme', CONFIRM),
    ],
    [
      'retrieveConfirmedQuote',
      (s: QuotesService) => s.retrieveConfirmedQuote('acme', 'TX1', 'pen_1'),
    ],
  ])('%s without a claim → rejected, MC is NOT called', async (_name, call) => {
    const { svc, client } = make({ owns: false });
    await expect(call(svc)).rejects.toBeInstanceOf(NotFoundException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('the gate keys on the body reference, not on the proposalId', async () => {
    const { svc, ownership } = make();
    await svc.confirmQuote('acme', CONFIRM);
    expect(ownership.assertOwnsRef).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme' }),
      'TX1',
    );
  });
});
