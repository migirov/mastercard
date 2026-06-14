import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { CredentialsService } from '../credentials/credentials.service';
import { McCredentials } from '../credentials/credentials.types';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  McRequest,
  MastercardClient,
} from '../mastercard/mastercard-client.service';
import { TenantRegistry } from '../tenants/tenant.registry';
import { Tenant } from '../tenants/tenant.types';
import { UpstreamHttpException } from '../common/upstream.exception';
import { CrossBorderService } from './crossborder.service';

const PID = 'SANDBOX_1234567';
const creds = {
  consumerKey: 'ck',
  signingKeyPem: 'pem',
  partnerId: PID,
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
  const registry = {
    get: jest.fn(async () => opts?.tenant ?? activeTenant),
  };
  const credentials = { resolve: jest.fn(async () => creds) };
  const idempotency = {
    run: jest.fn(
      (_t: string, _k: string | undefined, producer: () => unknown) =>
        producer(),
    ),
  };
  const svc = new CrossBorderService(
    registry as unknown as TenantRegistry,
    credentials as unknown as CredentialsService,
    client as unknown as MastercardClient,
    idempotency as unknown as IdempotencyService,
  );
  return { svc, client, registry, credentials };
}

/** Достаёт McRequest, переданный в client.request. */
const reqOf = (client: { request: jest.Mock }): McRequest =>
  client.request.mock.calls[0][1] as McRequest;

describe('CrossBorderService — path construction', () => {
  it('balances → /send/partners/{pid}/crossborder/accounts?include_balance=true', async () => {
    const { svc, client } = make();
    await svc.getBalances('acme');
    expect(reqOf(client)).toMatchObject({
      method: 'GET',
      path: `/send/partners/${PID}/crossborder/accounts?include_balance=true`,
    });
  });

  it('rates (GET) и cardedRatePull (POST) — один путь /send/v1/.../rates, разный метод', async () => {
    const a = make();
    await a.svc.getRates('acme');
    expect(reqOf(a.client)).toMatchObject({
      method: 'GET',
      path: `/send/v1/partners/${PID}/crossborder/rates`,
    });
    const b = make();
    await b.svc.cardedRatePull('acme');
    expect(reqOf(b.client)).toMatchObject({
      method: 'POST',
      path: `/send/v1/partners/${PID}/crossborder/rates`,
    });
  });

  it('createQuote → /send/v1/.../quotes; createPayment → /send/v1/.../payment', async () => {
    const q = make();
    await q.svc.createQuote('acme', {} as never);
    expect(reqOf(q.client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/quotes`,
    );
    const p = make();
    await p.svc.createPayment('acme', {} as never, undefined);
    expect(reqOf(p.client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/payment`,
    );
  });

  it('address-validation — собственная база (без /crossborder и без partner-id)', async () => {
    const { svc, client } = make();
    await svc.validateAddress('acme', {} as never);
    expect(reqOf(client).path).toBe(
      '/send/address-validation-service/addresses/validations',
    );
  });

  it('cash-pickup countries — база /crossborder (без /send, partner-id в заголовке)', async () => {
    const { svc, client } = make();
    await svc.cashPickupCountries('acme', 'PANY');
    const r = reqOf(client);
    expect(r.path).toBe(
      '/crossborder/cash-pickup/countries?cash_pickup_type=PANY',
    );
    expect(r.headers).toMatchObject({ 'partner-id': PID });
  });

  it('id/ref в пути — encodeURIComponent (анти-структурная инъекция)', async () => {
    const g = make();
    await g.svc.getPayment('acme', 'a b/c');
    expect(reqOf(g.client).path).toBe(
      `/send/v1/partners/${PID}/crossborder/${encodeURIComponent('a b/c')}`,
    );
  });

  it('mcRefHeaders: Partner-Ref-Id со срезанным CRLF + X-Mc-Correlation-Id', async () => {
    const crlfCreds = { ...creds, partnerId: 'PID\r\nX: y' } as McCredentials;
    const { svc, client, credentials } = make();
    (credentials.resolve as jest.Mock).mockResolvedValue(crlfCreds);
    await svc.validateAccount('acme', {} as never);
    const h = reqOf(client).headers ?? {};
    expect(h['Partner-Ref-Id']).toBe('PIDX: y'); // \r\n вырезаны
    expect(h['X-Mc-Correlation-Id']).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('CrossBorderService — call() dispatch', () => {
  it('2xx → данные', async () => {
    const { svc } = make({ status: 200, data: { proposal: 1 } });
    await expect(svc.getBalances('acme')).resolves.toEqual({ proposal: 1 });
  });

  it('бизнес-4xx с объектом → UpstreamHttpException с этим телом', async () => {
    const body = { Errors: { Error: { ReasonCode: 'X' } } };
    const { svc } = make({ status: 422, data: body });
    await expect(svc.getBalances('acme')).rejects.toMatchObject({
      upstream: body,
    });
    await expect(svc.getBalances('acme')).rejects.toBeInstanceOf(
      UpstreamHttpException,
    );
  });

  it('4xx с НЕ-объектом (HTML/строка) → 502, тело НЕ форвардится', async () => {
    const { svc } = make({ status: 429, data: '<html>rate limited</html>' });
    await expect(svc.getBalances('acme')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('401/403/5xx → 502 (не раскрываем)', async () => {
    for (const status of [401, 403, 500, 503]) {
      const { svc } = make({ status, data: { secret: 'x' } });
      await expect(svc.getBalances('acme')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    }
  });

  it('сетевая ошибка/сбой расшифровки → 502', async () => {
    const { svc } = make({ throws: true });
    await expect(svc.getBalances('acme')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('CrossBorderService — gating', () => {
  it('не-ACTIVE тенант → Forbidden, MC не вызывается', async () => {
    const inactive = { ...activeTenant, suspended: true } as Tenant;
    const { svc, client } = make({ tenant: inactive });
    await expect(svc.getBalances('acme')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.request).not.toHaveBeenCalled();
  });
});
