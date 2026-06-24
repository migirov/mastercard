import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { RfiService } from './rfi.service';

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
  return { svc: new RfiService(gw), client };
}

const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

// RFI lives on the WITHOUT-v1 base `/send/partners/{pid}/crossborder/rfi/...`. The
// request-id / document-id go INTO the path → encodeURIComponent (anti structural
// injection). Bodies (updateRequest / uploadDocumentRequest wrappers) are forwarded
// unchanged (encryption happens later in the interceptor).
describe('RfiService — request construction', () => {
  it('retrieveRfi → GET /send/partners/{pid}/crossborder/rfi/requests/{id} (id encoded)', async () => {
    const { svc, client } = make();
    await svc.retrieveRfi('acme', '33 abc/1');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/partners/${PID}/crossborder/rfi/requests/${encodeURIComponent('33 abc/1')}`,
    });
  });

  it('updateRfi → POST the same request path, forwards the body', async () => {
    const { svc, client } = make();
    const body = { updateRequest: { answer: 'x' } };
    await svc.updateRfi('acme', 'req 9', body as never);
    expect(reqOf(client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/rfi/requests/${encodeURIComponent('req 9')}`,
      body,
    });
  });

  it('uploadRfiDocument → POST /send/partners/{pid}/crossborder/rfi/documents, forwards the body', async () => {
    const { svc, client } = make();
    const body = { uploadDocumentRequest: { document: 'base64' } };
    await svc.uploadRfiDocument('acme', body as never);
    expect(reqOf(client)).toMatchObject({
      method: 'POST',
      path: `/send/partners/${PID}/crossborder/rfi/documents`,
      body,
    });
  });

  it('downloadRfiDocument → GET .../rfi/documents/{id} (id encoded)', async () => {
    const { svc, client } = make();
    await svc.downloadRfiDocument('acme', 'doc 7/2');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/partners/${PID}/crossborder/rfi/documents/${encodeURIComponent('doc 7/2')}`,
    });
  });
});
