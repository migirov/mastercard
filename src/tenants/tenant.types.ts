/** Where a partner's Mastercard keys come from. */
export enum CredentialMode {
  /** The platform's shared keys and partner-id; the merchant is a logical sub-account. */
  PLATFORM = 'PLATFORM',
  /** The partner's own keys and partner-id (secrets in Vault). The primary mode. */
  OWN = 'OWN',
}

/**
 * Computed partner access status (for display). IMPORTANT: the members are INDEPENDENT
 * partial approval states, NOT a linear sequence (platformApproved and mcApproved come
 * from different places); the order in the enum is not a state machine (see
 * effectiveStatus).
 */
export enum TenantStatus {
  PENDING = 'PENDING',
  PLATFORM_APPROVED = 'PLATFORM_APPROVED',
  MC_APPROVED = 'MC_APPROVED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/**
 * A partner (tenant). Approval is modeled with TWO independent flags, since it comes from
 * different places (platform vs Mastercard). The effective ACTIVE status is computed, not
 * stored — so that one cannot "set ACTIVE" in a bypass.
 */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly credentialMode: CredentialMode;
  /** OWN only: the partner's own partner-id. For PLATFORM the shared one is used. */
  readonly partnerId?: string;
  /** OWN only: the path to the partner's secrets in Vault. */
  readonly secretRef?: string;
  readonly platformApproved: boolean;
  readonly mcApproved: boolean;
  readonly suspended: boolean;
}

/** Transactions are allowed only with double approval and no suspension. */
export function isActive(t: Tenant): boolean {
  return !t.suspended && t.platformApproved && t.mcApproved;
}

/** Human-readable status from the flags. */
export function effectiveStatus(t: Tenant): TenantStatus {
  if (t.suspended) return TenantStatus.SUSPENDED;
  if (t.platformApproved && t.mcApproved) return TenantStatus.ACTIVE;
  if (t.platformApproved) return TenantStatus.PLATFORM_APPROVED;
  if (t.mcApproved) return TenantStatus.MC_APPROVED;
  return TenantStatus.PENDING;
}
