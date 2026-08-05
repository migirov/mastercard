import { NotImplementedException } from '@nestjs/common';
import { GatewayConfig } from '../../../config/gateway-config';
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

function make(authMode: 'oauth1' | 'oauth2-request-token' = 'oauth1') {
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
  const config = { authMode } as GatewayConfig;
  return { svc: new AccountsService(gw, config), client };
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

  // Mastercard routes Balance through the interactive OAuth2 Authorization Code
  // flow on the PSD2 edges, which this gateway does not implement. Refuse locally
  // instead of sending a call that can only come back as an opaque 502.
  it('balances on a PSD2 edge → 501 locally, Mastercard is NOT called', async () => {
    const { svc, client } = make('oauth2-request-token');

    expect(() => svc.getBalances('acme')).toThrow(NotImplementedException);
    expect(() => svc.getBalances('acme')).toThrow(/Authorization Code flow/);
    expect(client.request).not.toHaveBeenCalled();
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
