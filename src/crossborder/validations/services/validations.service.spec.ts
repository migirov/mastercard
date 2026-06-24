import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { ValidationsService } from './validations.service';

const PID = 'SANDBOX_1234567';
const creds = { partnerId: PID } as McCredentials;
const activeTenant = {
  id: 'acme',
  credentialMode: 'PLATFORM',
  platformApproved: true,
  mcApproved: true,
  suspended: false,
} as unknown as Tenant;

function make(over?: McCredentials) {
  const client = {
    request: jest.fn(async () => ({ status: 200, data: { ok: true } })),
  };
  const registry = { get: jest.fn(async () => activeTenant) };
  const credentials = { resolve: jest.fn(async () => over ?? creds) };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  return { svc: new ValidationsService(gw), client };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

describe('ValidationsService', () => {
  it('address-validation — its own base (no /crossborder and no partner-id)', async () => {
    const { svc, client } = make();
    await svc.validateAddress('acme', {} as never);
    expect(reqOf(client).path).toBe(
      '/send/address-validation-service/addresses/validations',
    );
  });

  it('mcRefHeaders: Partner-Ref-Id with CRLF stripped + X-Mc-Correlation-Id', async () => {
    const crlfCreds = { ...creds, partnerId: 'PID\r\nX: y' } as McCredentials;
    const { svc, client } = make(crlfCreds);
    await svc.validateAccount('acme', {} as never);
    const h = reqOf(client).headers ?? {};
    expect(h['Partner-Ref-Id']).toBe('PIDX: y'); // \r\n stripped
    expect(h['X-Mc-Correlation-Id']).toMatch(/[0-9a-f-]{36}/);
  });

  it('validateAccount → POST /send/partners/{pid}/crossborder/accounts/validations + body + ref header', async () => {
    const { svc, client } = make();
    const body = { accountUri: { type: 'IBAN', value: 'X' } };
    await svc.validateAccount('acme', body as never);
    const r = reqOf(client);
    expect(r).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/accounts/validations`,
      body,
    });
    expect(r.headers?.['Partner-Ref-Id']).toBe(PID);
  });

  it('lookupBank → POST /send/partners/{pid}/crossborder/banks/details + body', async () => {
    const { svc, client } = make();
    const body = { bank: { routingNumber: '1' } };
    await svc.lookupBank('acme', body as never);
    expect(reqOf(client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/banks/details`,
      body,
    });
  });

  it('generateIban → POST /send/partners/{pid}/crossborder/accounts/generate-ibans + body', async () => {
    const { svc, client } = make();
    const body = { country: 'DE' };
    await svc.generateIban('acme', body as never);
    expect(reqOf(client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/accounts/generate-ibans`,
      body,
    });
  });

  it('endpointGuide → GET /crossborder/endpoint-guide/specifications (no /send, no partner-id in path), qs built + ref header', async () => {
    const { svc, client } = make();
    await svc.endpointGuide('acme', {
      payment_type: 'P2P',
      destination_country: 'IND',
    } as never);
    const r = reqOf(client);
    expect(r.method).toBe('GET');
    expect(r.path).toBe(
      '/crossborder/endpoint-guide/specifications?payment_type=P2P&destination_country=IND',
    );
    expect(r.headers?.['Partner-Ref-Id']).toBe(PID);
  });
});
