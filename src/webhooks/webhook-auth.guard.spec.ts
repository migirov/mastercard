import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewayConfig } from '../config/gateway-config';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookSignatureVerifier } from './webhook-signature.verifier';

function ctxWith(
  headers: Record<string, unknown>,
  rawBody?: Buffer,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, rawBody }) }),
  } as unknown as ExecutionContext;
}

describe('WebhookAuthGuard', () => {
  const verifier: WebhookSignatureVerifier = { verify: jest.fn() };

  function guardWith(webhookToken?: string): WebhookAuthGuard {
    const config = { webhookToken } as unknown as GatewayConfig;
    return new WebhookAuthGuard(config, verifier);
  }

  beforeEach(() => (verifier.verify as jest.Mock).mockReturnValue(true));

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

  it('accepts the correct token (and a valid signature)', () => {
    expect(
      guardWith('secret').canActivate(ctxWith({ 'x-webhook-token': 'secret' })),
    ).toBe(true);
  });

  it('rejects when the signature verifier returns false', () => {
    (verifier.verify as jest.Mock).mockReturnValue(false);
    expect(() =>
      guardWith('secret').canActivate(ctxWith({ 'x-webhook-token': 'secret' })),
    ).toThrow(UnauthorizedException);
  });
});
