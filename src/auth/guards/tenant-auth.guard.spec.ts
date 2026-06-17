import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GatewayConfig } from '../../config/gateway-config';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { TenantAuthGuard } from './tenant-auth.guard';

interface FakeReq {
  headers: Record<string, unknown>;
  tenantContext?: { tenantId: string; source: string };
}
function ctxFor(req: FakeReq): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TenantAuthGuard', () => {
  const tenant = { id: 't1', name: 'T' };

  function make(over?: {
    verify?: jest.Mock;
    get?: jest.Mock;
    internalToken?: string;
  }): TenantAuthGuard {
    const jwt = { verify: over?.verify ?? jest.fn() } as unknown as JwtService;
    const registry = {
      get: over?.get ?? jest.fn().mockResolvedValue(tenant),
    } as unknown as TenantRegistry;
    const config = {
      internalToken: over?.internalToken ?? 'INT',
    } as unknown as GatewayConfig;
    return new TenantAuthGuard(jwt, registry, config);
  }

  describe('internal path (X-Internal-Token)', () => {
    it('rejects a wrong internal token', async () => {
      const req = {
        headers: { 'x-internal-token': 'WRONG', 'x-tenant-id': 't1' },
      };
      await expect(make().canActivate(ctxFor(req))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('requires x-tenant-id (400) even with a valid internal token', async () => {
      const req = { headers: { 'x-internal-token': 'INT' } };
      await expect(make().canActivate(ctxFor(req))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sets internal context on success', async () => {
      const req: FakeReq = {
        headers: { 'x-internal-token': 'INT', 'x-tenant-id': 't1' },
      };
      await expect(make().canActivate(ctxFor(req))).resolves.toBe(true);
      expect(req.tenantContext).toMatchObject({
        tenantId: 't1',
        source: 'internal',
      });
    });
  });

  describe('external path (Bearer JWT)', () => {
    it('rejects a missing / non-Bearer Authorization', async () => {
      await expect(
        make().canActivate(ctxFor({ headers: {} })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid JWT (verify throws → invalid_token)', async () => {
      const verify = jest.fn(() => {
        throw new Error('bad');
      });
      const req = { headers: { authorization: 'Bearer xxx' } };
      await expect(
        make({ verify }).canActivate(ctxFor(req)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a valid JWT whose tenant no longer exists (unknown tenant, NOT 404)', async () => {
      const verify = jest.fn(() => ({ tid: 'gone' }));
      const get = jest.fn().mockRejectedValue(new Error('not found'));
      const req = { headers: { authorization: 'Bearer ok' } };
      await expect(
        make({ verify, get }).canActivate(ctxFor(req)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('sets external context on success', async () => {
      const verify = jest.fn(() => ({ tid: 't1' }));
      const req: FakeReq = { headers: { authorization: 'Bearer ok' } };
      await expect(make({ verify }).canActivate(ctxFor(req))).resolves.toBe(
        true,
      );
      expect(req.tenantContext).toMatchObject({
        tenantId: 't1',
        source: 'external',
      });
    });
  });
});
