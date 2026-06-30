import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { AdminAuthGuard } from './admin-auth.guard';

function ctxWith(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AdminAuthGuard', () => {
  const guardWith = (adminToken?: string) =>
    new AdminAuthGuard({ adminToken } as unknown as GatewayConfig);

  it('fail-closed: rejects when no admin token is configured', () => {
    expect(() => guardWith(undefined).canActivate(ctxWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing token header', () => {
    expect(() => guardWith('secret').canActivate(ctxWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong token', () => {
    expect(() =>
      guardWith('secret').canActivate(ctxWith({ 'x-admin-token': 'nope' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the correct token', () => {
    expect(
      guardWith('secret').canActivate(ctxWith({ 'x-admin-token': 'secret' })),
    ).toBe(true);
  });
});
