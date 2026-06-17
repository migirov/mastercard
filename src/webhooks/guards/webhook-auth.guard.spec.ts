import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { WebhookAuthGuard } from './webhook-auth.guard';

function ctxWith(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('WebhookAuthGuard', () => {
  function guardWith(webhookToken?: string): WebhookAuthGuard {
    const config = { webhookToken } as unknown as GatewayConfig;
    return new WebhookAuthGuard(config);
  }

  it('fail-closed: rejects when no token is configured (does NOT trust the ingress)', () => {
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
      guardWith('secret').canActivate(ctxWith({ 'x-webhook-token': 'nope' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the correct token', () => {
    expect(
      guardWith('secret').canActivate(ctxWith({ 'x-webhook-token': 'secret' })),
    ).toBe(true);
  });
});
