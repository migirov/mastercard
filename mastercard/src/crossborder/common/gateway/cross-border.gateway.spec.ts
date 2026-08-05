import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { CredentialsService } from '../../../credentials/services/credentials.service';
import { McCredentials } from '../../../credentials/credentials.types';
import {
  McRequest,
  MastercardClient,
} from '../../../mastercard/services/mastercard-client.service';
import {
  AuthHeaderError,
  RequestEncryptError,
  ResponseDecryptError,
} from '../../../mastercard/services/mc.errors';
import { TenantRegistry } from '../../../tenants/services/tenant.registry';
import { Tenant } from '../../../tenants/tenant.types';
import {
  UpstreamHttpException,
  UpstreamUnavailableException,
} from '../../../common/utils/upstream.exception';
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
  rejectWith?: Error;
  tenant?: Tenant;
}) {
  const client = {
    request: jest.fn(async (_c: McCredentials, _r: McRequest) => {
      if (opts?.rejectWith) throw opts.rejectWith;
      if (opts?.throws) throw new Error('network');
      return { status: opts?.status ?? 200, data: opts?.data ?? { ok: true } };
    }),
    upstreamHost: 'mc.test',
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
  it('2xx → data', async () => {
    const { gw } = make({ status: 200, data: { proposal: 1 } });
    await expect(ping(gw)).resolves.toEqual({ proposal: 1 });
  });

  it('business 4xx with an object → UpstreamHttpException with that body', async () => {
    const body = { Errors: { Error: { ReasonCode: 'X' } } };
    const { gw } = make({ status: 422, data: body });
    await expect(ping(gw)).rejects.toMatchObject({ upstream: body });
    await expect(
      ping(make({ status: 422, data: body }).gw),
    ).rejects.toBeInstanceOf(UpstreamHttpException);
  });

  it('4xx with a NON-object (HTML/string) → 502, body is NOT forwarded, executed=unknown', async () => {
    const { gw } = make({ status: 429, data: '<html>rate limited</html>' });
    await expect(ping(gw)).rejects.toBeInstanceOf(BadGatewayException);
    await expect(
      ping(make({ status: 429, data: '<html/>' }).gw),
    ).rejects.toMatchObject({ executed: 'unknown' });
  });

  it('401/403 → 502 (not disclosed) with executed=no (auth rejection → payment did not run)', async () => {
    for (const status of [401, 403]) {
      const { gw } = make({ status, data: { secret: 'x' } });
      await expect(ping(gw)).rejects.toBeInstanceOf(
        UpstreamUnavailableException,
      );
      await expect(ping(make({ status, data: {} }).gw)).rejects.toMatchObject({
        executed: 'no',
      });
    }
  });

  it('5xx → 502 (not disclosed) with executed=unknown (outcome indeterminate → hold the slot)', async () => {
    for (const status of [500, 503]) {
      const { gw } = make({ status, data: { secret: 'x' } });
      await expect(ping(gw)).rejects.toMatchObject({ executed: 'unknown' });
    }
  });

  // The pre-send / post-send split decides whether a payment idempotency slot is
  // released or held. Without these, inverting the classification in call() — or
  // deleting the `sent` check entirely — passes the whole suite.
  it('a PRE-SEND failure (auth header / request encryption) → executed=no, the slot is released', async () => {
    for (const e of [
      new AuthHeaderError('mint failed'),
      new RequestEncryptError('per-tenant fail-loud'),
    ]) {
      const { gw } = make({ rejectWith: e });
      await expect(ping(gw)).rejects.toMatchObject({ executed: 'no' });
    }
  });

  it('a POST-SEND failure (response decryption) → executed=unknown, the slot is HELD', async () => {
    // MC received the request and may have executed the payment.
    const { gw } = make({ rejectWith: new ResponseDecryptError('bad key') });
    await expect(ping(gw)).rejects.toMatchObject({ executed: 'unknown' });
  });

  it('network error/decryption failure → 502, executed=unknown', async () => {
    const { gw } = make({ throws: true });
    await expect(ping(gw)).rejects.toBeInstanceOf(BadGatewayException);
    await expect(ping(make({ throws: true }).gw)).rejects.toMatchObject({
      executed: 'unknown',
    });
  });
});

describe('CrossBorderGateway — gating', () => {
  it('non-ACTIVE tenant → Forbidden, MC is not called', async () => {
    const inactive = { ...activeTenant, suspended: true } as Tenant;
    const { gw, client } = make({ tenant: inactive });
    await expect(ping(gw)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('activeTenant returns the Tenant itself (callers need credentialMode)', async () => {
    const { gw, registry } = make();
    await expect(gw.activeTenant('acme')).resolves.toBe(activeTenant);
    expect(registry.get).toHaveBeenCalledWith('acme');
  });

  it('activeTenant rejects a non-ACTIVE tenant without resolving credentials', async () => {
    const inactive = { ...activeTenant, suspended: true } as Tenant;
    const { gw, client } = make({ tenant: inactive });
    await expect(gw.activeTenant('acme')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.request).not.toHaveBeenCalled();
  });

  // runFor is for callers that already gated (to run an ownership check); paying for a
  // second registry read would defeat the point of splitting the gate out.
  it('runFor does NOT re-gate — the registry is not read again', async () => {
    const { gw, registry, client } = make({ data: { ok: 1 } });
    await expect(
      gw.runFor(
        activeTenant,
        'ctx',
        () => ({ method: 'GET', path: '/x' }) as McRequest,
      ),
    ).resolves.toEqual({ ok: 1 });
    expect(registry.get).not.toHaveBeenCalled();
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it('run() still gates exactly once (one registry read per call)', async () => {
    const { gw, registry } = make();
    await ping(gw);
    expect(registry.get).toHaveBeenCalledTimes(1);
  });
});
