import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { AccountsService } from './accounts.service';

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
  return { svc: new AccountsService(gw), client };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

describe('AccountsService', () => {
  it('balances → /send/partners/{pid}/crossborder/accounts?include_balance=true', async () => {
    const { svc, client } = make();
    await svc.getBalances('acme');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/partners/${PID}/crossborder/accounts?include_balance=true`,
    });
  });

  it('rates (Carded/FX Rate Pull) — GET /send/v1/.../rates with no body', async () => {
    const { svc, client } = make();
    await svc.getRates('acme');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/v1/partners/${PID}/crossborder/rates`,
    });
  });
});
