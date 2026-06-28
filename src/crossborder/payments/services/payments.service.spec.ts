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

function make() {
  const client = {
    request: jest.fn(async () => ({ status: 200, data: { ok: true } })),
  };
  const registry = { get: jest.fn(async () => activeTenant) };
  const credentials = { resolve: jest.fn(async () => creds) };
  const idempotency = {
    run: jest.fn(
      (_t: string, _k: string | undefined, producer: () => unknown) =>
        producer(),
    ),
    ownsKey: jest.fn(async () => true),
  };
  const statusEvents = { findForTenant: jest.fn(async () => []) };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  const svc = new PaymentsService(
    gw,
    idempotency as unknown as PaymentIdempotencyStore,
    statusEvents as unknown as TransactionStatusStore,
  );
  return { svc, client, idempotency, statusEvents };
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

describe('PaymentsService — status events (local read)', () => {
  const ownTenant = { id: 'own-1', credentialMode: 'OWN' } as unknown as Tenant;
  const platformTenant = {
    id: 'acme',
    credentialMode: 'PLATFORM',
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
    const { svc, statusEvents, client, idempotency } = make();
    (statusEvents.findForTenant as jest.Mock).mockResolvedValue(rows);
    const out = await svc.getStatusEvents(ownTenant, 'TX1');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'own-1',
      'TX1',
      false,
    );
    // OWN never reads the pool — no ownership check needed.
    expect(idempotency.ownsKey).not.toHaveBeenCalled();
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

  it('PLATFORM + owns the payment → includePool=true (reads the shared null pool)', async () => {
    const { svc, statusEvents, idempotency } = make();
    idempotency.ownsKey.mockResolvedValue(true);
    await svc.getStatusEvents(platformTenant, 'TX2');
    expect(idempotency.ownsKey).toHaveBeenCalledWith(
      'acme',
      `txref:${sha256hex('TX2')}`,
    );
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      true,
    );
  });

  it('PLATFORM + does NOT own the ref → includePool=false (no cross-tenant pool read)', async () => {
    const { svc, statusEvents, idempotency } = make();
    idempotency.ownsKey.mockResolvedValue(false);
    await svc.getStatusEvents(platformTenant, 'TX2');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      false,
    );
  });
});
