import {
  CredentialMode,
  effectiveStatus,
  isActive,
  Tenant,
  TenantStatus,
} from './tenant.types';

const base: Tenant = {
  id: 't1',
  name: 'Test',
  credentialMode: CredentialMode.OWN,
  platformApproved: false,
  mcApproved: false,
  suspended: false,
};

describe('tenant.types', () => {
  describe('isActive', () => {
    it('is true only with both approvals and not suspended', () => {
      expect(
        isActive({ ...base, platformApproved: true, mcApproved: true }),
      ).toBe(true);
    });

    it('is false when suspended even if both approved', () => {
      expect(
        isActive({
          ...base,
          platformApproved: true,
          mcApproved: true,
          suspended: true,
        }),
      ).toBe(false);
    });

    it('is false with only one approval', () => {
      expect(isActive({ ...base, platformApproved: true })).toBe(false);
      expect(isActive({ ...base, mcApproved: true })).toBe(false);
    });
  });

  describe('effectiveStatus', () => {
    it('SUSPENDED takes precedence over everything', () => {
      expect(
        effectiveStatus({
          ...base,
          platformApproved: true,
          mcApproved: true,
          suspended: true,
        }),
      ).toBe(TenantStatus.SUSPENDED);
    });

    it('ACTIVE when both approved', () => {
      expect(
        effectiveStatus({ ...base, platformApproved: true, mcApproved: true }),
      ).toBe(TenantStatus.ACTIVE);
    });

    it('PLATFORM_APPROVED / MC_APPROVED / PENDING for partial state', () => {
      expect(effectiveStatus({ ...base, platformApproved: true })).toBe(
        TenantStatus.PLATFORM_APPROVED,
      );
      expect(effectiveStatus({ ...base, mcApproved: true })).toBe(
        TenantStatus.MC_APPROVED,
      );
      expect(effectiveStatus(base)).toBe(TenantStatus.PENDING);
    });
  });
});
