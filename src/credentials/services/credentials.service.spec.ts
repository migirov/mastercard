import { CredentialMode, Tenant } from '../../tenants/tenant.types';
import { McCredentials } from '../credentials.types';
import { CredentialsService } from './credentials.service';
import { OwnCredentialsProvider } from './own-credentials.provider';
import { PlatformCredentialsProvider } from './platform-credentials.provider';

const platformCreds = { consumerKey: 'platform' } as McCredentials;
const ownCreds = { consumerKey: 'own' } as McCredentials;

const tenant = (mode: CredentialMode): Tenant =>
  ({ id: 't1', credentialMode: mode }) as unknown as Tenant;

function make() {
  const platform = {
    get: jest.fn(() => platformCreds),
  } as unknown as PlatformCredentialsProvider;
  const own = {
    get: jest.fn(async () => ownCreds),
    invalidate: jest.fn(),
  } as unknown as OwnCredentialsProvider;
  return { svc: new CredentialsService(platform, own), platform, own };
}

describe('CredentialsService — facade dispatch', () => {
  it('PLATFORM → PlatformCredentialsProvider (OWN untouched)', async () => {
    const { svc, platform, own } = make();
    await expect(svc.resolve(tenant(CredentialMode.PLATFORM))).resolves.toBe(
      platformCreds,
    );
    expect(platform.get).toHaveBeenCalledTimes(1);
    expect(own.get).not.toHaveBeenCalled();
  });

  it('OWN → OwnCredentialsProvider with the tenant (PLATFORM untouched)', async () => {
    const { svc, platform, own } = make();
    const t = tenant(CredentialMode.OWN);
    await expect(svc.resolve(t)).resolves.toBe(ownCreds);
    expect(own.get).toHaveBeenCalledWith(t);
    expect(platform.get).not.toHaveBeenCalled();
  });

  it('invalidate delegates to the OWN provider', () => {
    const { svc, own } = make();
    svc.invalidate('acme');
    expect(own.invalidate).toHaveBeenCalledWith('acme');
  });

  it('unknown credentialMode throws (programming error)', () => {
    const { svc } = make();
    expect(() => svc.resolve(tenant('weird' as CredentialMode))).toThrow(
      /Unknown credentialMode/,
    );
  });
});
