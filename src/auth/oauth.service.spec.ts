import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ClientRegistry } from './client-registry';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  const clients = { validate: jest.fn() };
  const jwt = { sign: jest.fn() };
  let svc: OAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: ClientRegistry, useValue: clients },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    svc = moduleRef.get(OAuthService);
  });

  it('issues a Bearer token for a valid client', async () => {
    clients.validate.mockResolvedValue('tenant-1');
    jwt.sign.mockReturnValue('signed.jwt.token');

    const r = await svc.issueToken('client-id', 'client-secret');

    expect(r).toEqual({
      access_token: 'signed.jwt.token',
      token_type: 'Bearer',
      expires_in: 900,
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      { tid: 'tenant-1' },
      expect.objectContaining({ subject: 'client-id' }),
    );
  });

  it('throws invalid_client and never signs for bad credentials', async () => {
    clients.validate.mockResolvedValue(null);
    await expect(svc.issueToken('client-id', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
