import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import { UpstreamHttpException } from '../../../common/utils/upstream.exception';
import { CrossBorderGateway } from './cross-border.gateway';

const creds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: 'SANDBOX_1234567',
} as McCredentials;

const activeTenant = {
  id: 'acme',
  credentialMode: 'PLATFORM',
  platformApproved: true,
  mcApproved: true,
  suspended: false,
} as unknown as Tenant;

function make(opts?: {
  status?: number;
  data?: unknown;
  throws?: boolean;
  tenant?: Tenant;
}) {
  const client = {
    request: jest.fn(async (_c: McCredentials, _r: McRequest) => {
      if (opts?.throws) throw new Error('network');
      return { status: opts?.status ?? 200, data: opts?.data ?? { ok: true } };
    }),
  };
  const registry = { get: jest.fn(async () => opts?.tenant ?? activeTenant) };
  const credentials = { resolve: jest.fn(async () => creds) };
  const gw = new CrossBorderGateway(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
  );
  return { gw, client, registry };
}

/** Trivial build — path is irrelevant for dispatch/gating tests. */
const ping = (gw: CrossBorderGateway, ctx = 'ctx') =>
  gw.run(ctx, ctx, () => ({ method: 'GET', path: '/x' }) as McRequest);

describe('CrossBorderGateway — call() dispatch', () => {
  it('2xx → данные', async () => {
    const { gw } = make({ status: 200, data: { proposal: 1 } });
    await expect(ping(gw)).resolves.toEqual({ proposal: 1 });
  });

  it('бизнес-4xx с объектом → UpstreamHttpException с этим телом', async () => {
    const body = { Errors: { Error: { ReasonCode: 'X' } } };
    const { gw } = make({ status: 422, data: body });
    await expect(ping(gw)).rejects.toMatchObject({ upstream: body });
    await expect(
      ping(make({ status: 422, data: body }).gw),
    ).rejects.toBeInstanceOf(UpstreamHttpException);
  });

  it('4xx с НЕ-объектом (HTML/строка) → 502, тело НЕ форвардится', async () => {
    const { gw } = make({ status: 429, data: '<html>rate limited</html>' });
    await expect(ping(gw)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('401/403/5xx → 502 (не раскрываем)', async () => {
    for (const status of [401, 403, 500, 503]) {
      const { gw } = make({ status, data: { secret: 'x' } });
      await expect(ping(gw)).rejects.toBeInstanceOf(BadGatewayException);
    }
  });

  it('сетевая ошибка/сбой расшифровки → 502', async () => {
    const { gw } = make({ throws: true });
    await expect(ping(gw)).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('CrossBorderGateway — gating', () => {
  it('не-ACTIVE тенант → Forbidden, MC не вызывается', async () => {
    const inactive = { ...activeTenant, suspended: true } as Tenant;
    const { gw, client } = make({ tenant: inactive });
    await expect(ping(gw)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.request).not.toHaveBeenCalled();
  });
});
