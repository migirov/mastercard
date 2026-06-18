import { CredentialsService } from '../../credentials/services/credentials.service';
import { McCredentials } from '../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { Tenant } from '../../tenants/tenant.types';
import { sha256hex } from '../../common/utils/crypto.util';
import { TransactionStatusStore } from '../../webhooks/services/transaction-status.store';
import { CrossBorderGateway } from '../gateway/cross-border.gateway';
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

  it('createPayment — ключ идемпотентности = txref:sha256(transaction_reference)', async () => {
    const { svc, idempotency } = make();
    const ref = '08POC342598033X';
    await svc.createPayment('acme', {
      paymentrequest: { transaction_reference: ref },
    } as never);
    const call = idempotency.run.mock.calls[0];
    expect(call[0]).toBe('acme');
    expect(call[1]).toBe(`txref:${sha256hex(ref)}`);
  });

  it('createPayment без transaction_reference → ключ undefined (без идемпотентности)', async () => {
    const { svc, idempotency } = make();
    await svc.createPayment('acme', {} as never);
    expect(idempotency.run.mock.calls[0][1]).toBeUndefined();
  });

  it('id в пути — encodeURIComponent (анти-структурная инъекция)', async () => {
    const { svc, client } = make();
    await svc.getPayment('acme', 'a b/c');
    expect(reqOf(client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/${encodeURIComponent('a b/c')}`,
    );
  });
});

describe('PaymentsService — status events (локальное чтение)', () => {
  const ownTenant = { id: 'own-1', credentialMode: 'OWN' } as unknown as Tenant;
  const platformTenant = {
    id: 'acme',
    credentialMode: 'PLATFORM',
  } as unknown as Tenant;

  it('OWN → findForTenant(id, ref, includePool=false); маппинг в view (без id/tenantId); MC не вызывается', async () => {
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
    const { svc, statusEvents, client } = make();
    (statusEvents.findForTenant as jest.Mock).mockResolvedValue(rows);
    const out = await svc.getStatusEvents(ownTenant, 'TX1');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'own-1',
      'TX1',
      false,
    );
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

  it('PLATFORM → includePool=true (читает общий null-пул)', async () => {
    const { svc, statusEvents } = make();
    await svc.getStatusEvents(platformTenant, 'TX2');
    expect(statusEvents.findForTenant).toHaveBeenCalledWith(
      'acme',
      'TX2',
      true,
    );
  });
});
