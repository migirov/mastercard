import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewayConfig } from '../../config/gateway-config';
import { WebhookAuthGuard } from './webhook-auth.guard';

function ctxWith(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const MC_CN = 'CrossborderServicesNotification-prod.mastercard.com';

/** A fake TLS socket exposing the bits the guard reads. */
function socket(opts: { authorized?: boolean; cn?: string | null }): unknown {
  return {
    authorized: opts.authorized ?? false,
    getPeerCertificate: () =>
      opts.cn === undefined ? {} : { subject: { CN: opts.cn } },
  };
}

describe('WebhookAuthGuard', () => {
  function guard(config: Partial<GatewayConfig>): WebhookAuthGuard {
    return new WebhookAuthGuard(config as GatewayConfig);
  }

  describe('shared token (mTLS off — dev fallback)', () => {
    function tokenGuard(webhookToken?: string): WebhookAuthGuard {
      return guard({ webhookMtlsEnabled: false, webhookToken });
    }

    it('fail-closed: rejects when no token is configured (does NOT trust the ingress)', () => {
      expect(() => tokenGuard(undefined).canActivate(ctxWith({ headers: {} }))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a missing token header', () => {
      expect(() => tokenGuard('secret').canActivate(ctxWith({ headers: {} }))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong token', () => {
      expect(() =>
        tokenGuard('secret').canActivate(
          ctxWith({ headers: { 'x-webhook-token': 'nope' } }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('accepts the correct token', () => {
      expect(
        tokenGuard('secret').canActivate(
          ctxWith({ headers: { 'x-webhook-token': 'secret' } }),
        ),
      ).toBe(true);
    });
  });

  describe('in-app mTLS client certificate', () => {
    function mtlsGuard(): WebhookAuthGuard {
      return guard({
        webhookMtlsEnabled: true,
        webhookAllowedClientCNs: [MC_CN],
      });
    }

    it('rejects when TLS is not terminated in-app (no getPeerCertificate)', () => {
      // plain HTTP socket / TLS terminated upstream ⇒ fail-closed
      expect(() => mtlsGuard().canActivate(ctxWith({ socket: {} }))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an untrusted certificate chain (authorized=false)', () => {
      expect(() =>
        mtlsGuard().canActivate(
          ctxWith({ socket: socket({ authorized: false, cn: MC_CN }) }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('rejects when no client certificate was presented', () => {
      expect(() =>
        mtlsGuard().canActivate(
          ctxWith({ socket: socket({ authorized: true, cn: undefined }) }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a trusted cert whose CN is not in the allowlist', () => {
      expect(() =>
        mtlsGuard().canActivate(
          ctxWith({ socket: socket({ authorized: true, cn: 'evil.example.com' }) }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('accepts a trusted cert with an allowlisted CN', () => {
      expect(
        mtlsGuard().canActivate(
          ctxWith({ socket: socket({ authorized: true, cn: MC_CN }) }),
        ),
      ).toBe(true);
    });

    it('does NOT fall back to the token when mTLS is enabled', () => {
      // a valid token must not rescue a missing/invalid client cert
      const g = guard({
        webhookMtlsEnabled: true,
        webhookAllowedClientCNs: [MC_CN],
        webhookToken: 'secret',
      });
      expect(() =>
        g.canActivate(
          ctxWith({ socket: {}, headers: { 'x-webhook-token': 'secret' } }),
        ),
      ).toThrow(UnauthorizedException);
    });
  });
});
