import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GatewayExceptionFilter } from './gateway-exception.filter';
import { UpstreamHttpException } from '../utils/upstream.exception';

function makeHost(req: Record<string, unknown>) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as never;
  return { host, res };
}

describe('GatewayExceptionFilter', () => {
  const filter = new GatewayExceptionFilter();

  it('wraps a standard HttpException in the unified envelope', () => {
    const { host, res } = makeHost({
      url: '/admin/tenants',
      path: '/admin/tenants',
      method: 'POST',
      headers: { 'x-request-id': 'req-1' },
    });
    filter.catch(new BadRequestException('bad input'), host);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'bad input',
      path: '/admin/tenants',
      requestId: 'req-1',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('prefers the pino-set req.id over the X-Request-Id header', () => {
    const { host, res } = makeHost({
      url: '/admin/tenants',
      path: '/admin/tenants',
      method: 'POST',
      id: 'pino-uuid-123',
      headers: { 'x-request-id': 'client-supplied' },
    });
    filter.catch(new BadRequestException('x'), host);
    expect(res.json.mock.calls[0][0].requestId).toBe('pino-uuid-123');
  });

  it('drops a malformed X-Request-Id (anti echo-injection) — requestId omitted', () => {
    const { host, res } = makeHost({
      url: '/admin/tenants',
      path: '/admin/tenants',
      method: 'POST',
      headers: { 'x-request-id': 'bad\r\ninjected: 1' },
    });
    filter.catch(new BadRequestException('x'), host);
    const body = res.json.mock.calls[0][0];
    expect(body.requestId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('injected');
  });

  it('nests the Mastercard body under "upstream"', () => {
    const { host, res } = makeHost({
      url: '/crossborder/quotes',
      path: '/crossborder/quotes',
      method: 'POST',
      headers: {},
    });
    const mc = { Errors: { Error: { ReasonCode: 'DECLINE' } } };
    filter.catch(new UpstreamHttpException(mc, 400), host);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('Upstream Error');
    expect(body.upstream).toEqual(mc);
  });

  it('formats /oauth/token errors per RFC 6749 (just {error})', () => {
    const { host, res } = makeHost({
      url: '/oauth/token',
      path: '/oauth/token',
      method: 'POST',
      headers: {},
    });
    filter.catch(new UnauthorizedException('invalid_client'), host);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0]).toEqual({ error: 'invalid_client' });
  });

  it('maps a 5xx on /oauth/token to server_error (not invalid_request)', () => {
    const { host, res } = makeHost({
      url: '/oauth/token',
      path: '/oauth/token',
      method: 'POST',
      headers: {},
    });
    filter.catch(new Error('db down'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({ error: 'server_error' });
  });

  it('coerces a validator message on /oauth/token to invalid_request', () => {
    const { host, res } = makeHost({
      url: '/oauth/token',
      path: '/oauth/token',
      method: 'POST',
      headers: {},
    });
    filter.catch(
      new BadRequestException('grant_type must be one of the following values'),
      host,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual({ error: 'invalid_request' });
  });

  it('maps a non-HTTP error to 500 without leaking internals', () => {
    const { host, res } = makeHost({
      url: '/crossborder/balances',
      path: '/crossborder/balances',
      method: 'GET',
      headers: {},
    });
    filter.catch(new Error('secret connection string'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret connection string');
  });
});
