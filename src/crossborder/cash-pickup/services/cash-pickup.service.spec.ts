import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { CashPickupService } from './cash-pickup.service';

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
  return { svc: new CashPickupService(gw), client };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

describe('CashPickupService', () => {
  it('countries — /crossborder base (no /send, partner-id in the header)', async () => {
    const { svc, client } = make();
    await svc.cashPickupCountries('acme', 'PANY');
    const r = reqOf(client);
    expect(r.path).toBe(
      '/crossborder/cash-pickup/countries?cash_pickup_type=PANY',
    );
    expect(r.headers).toMatchObject({ 'partner-id': PID });
  });
});
