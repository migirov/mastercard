import { instanceToPlain, plainToInstance } from 'class-transformer';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import {
  CredentialMode,
  effectiveStatus,
  TenantStatus,
} from '../../tenants/tenant.types';
import { IssuedClientDto } from './issued-client.dto';
import { TenantViewDto } from './tenant-view.dto';

/** Build an OWN-partner entity with a secret for leak checks. */
function ownTenant(): TenantEntity {
  return Object.assign(new TenantEntity(), {
    id: 'own-sandbox',
    name: 'Own Sandbox',
    credentialMode: CredentialMode.OWN,
    partnerId: 'SANDBOX_1234567',
    // AWS Secrets Manager ARN — must NOT leak outward
    secretRef:
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:mc/own/own-sandbox',
    platformApproved: true,
    mcApproved: true,
    suspended: false,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
  });
}

describe('Tenant serialization (secret-leak closure)', () => {
  it('@Exclude hides secretRef when serializing the entity itself', () => {
    // Protection at the source: if a handler returns TenantEntity directly, the secret
    // is still dropped (ClassSerializerInterceptor calls instanceToPlain).
    const plain = instanceToPlain(ownTenant());
    expect(plain).not.toHaveProperty('secretRef');
    expect(plain.id).toBe('own-sandbox');
  });

  it('TenantViewDto whitelist: only @Expose fields, no secretRef or timestamps', () => {
    const t = ownTenant();
    const view = plainToInstance(
      TenantViewDto,
      { ...t, status: effectiveStatus(t) },
      { excludeExtraneousValues: true },
    );

    expect(view).not.toHaveProperty('secretRef');
    expect(view).not.toHaveProperty('createdAt');
    expect(view).not.toHaveProperty('updatedAt');
    expect(view.id).toBe('own-sandbox');
    expect(view.partnerId).toBe('SANDBOX_1234567');
    expect(view.status).toBe(TenantStatus.ACTIVE);

    // And the serialized output also has no secret.
    expect(instanceToPlain(view)).not.toHaveProperty('secretRef');
  });

  it('a hypothetical new sensitive column does not leak (whitelist)', () => {
    const t = ownTenant() as TenantEntity & { apiKey?: string };
    t.apiKey = 'super-secret-future-column';
    const view = plainToInstance(
      TenantViewDto,
      { ...t, status: effectiveStatus(t) },
      { excludeExtraneousValues: true },
    );
    expect(view).not.toHaveProperty('apiKey');
  });

  it('IssuedClientDto exposes clientSecret (it MUST be returned once)', () => {
    const dto = plainToInstance(
      IssuedClientDto,
      { clientId: 'mc_abc', clientSecret: 'raw-secret', note: 'save it' },
      { excludeExtraneousValues: true },
    );
    expect(dto.clientSecret).toBe('raw-secret');
    expect(instanceToPlain(dto)).toEqual({
      clientId: 'mc_abc',
      clientSecret: 'raw-secret',
      note: 'save it',
    });
  });
});
