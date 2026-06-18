import { CredentialsService } from '../../credentials/services/credentials.service';
import { McCredentials } from '../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { Tenant } from '../../tenants/tenant.types';
import { CrossBorderGateway } from '../gateway/cross-border.gateway';
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

function make() {
  const client = {
    request: jest.fn(async () => ({ status: 200, data: { ok: true } })),
  };
  const registry = { get: jest.fn(async () => activeTenant) };
  const credentials = { resolve: jest.fn(async () => creds) };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  return { svc: new QuotesService(gw), client };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

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
    await a.svc.confirmQuote('acme', {} as never);
    expect(reqOf(a.client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/quotes/confirmations`,
    });
    const b = make();
    await b.svc.cancelConfirmedQuote('acme', {} as never);
    expect(reqOf(b.client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/quotes/cancellations`,
    });
  });

  it('retrieveConfirmedQuote — GET .../quotes/{ref}/proposals/{proposalId}, оба сегмента кодируются', async () => {
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
