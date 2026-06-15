/** Откуда берутся ключи Mastercard для партнёра. */
export enum CredentialMode {
  /** Общие ключи и partner-id платформы; мерчант — логический суб-аккаунт. */
  PLATFORM = 'PLATFORM',
  /** Собственные ключи партнёра и его partner-id (секреты в Vault). Основной. */
  OWN = 'OWN',
}

/**
 * Вычисляемый статус доступа партнёра (для отображения). ВАЖНО: члены —
 * НЕЗАВИСИМЫЕ частичные состояния одобрения, а НЕ линейная последовательность
 * (platformApproved и mcApproved приходят из разных мест); порядок в enum —
 * не машина состояний (см. effectiveStatus).
 */
export enum TenantStatus {
  PENDING = 'PENDING',
  PLATFORM_APPROVED = 'PLATFORM_APPROVED',
  MC_APPROVED = 'MC_APPROVED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Партнёр (tenant). Одобрение моделируется ДВУМЯ независимыми флагами, т.к.
 * приходит из разных мест (платформа vs Mastercard). Эффективный статус ACTIVE
 * вычисляется, а не хранится — чтобы нельзя было «выставить ACTIVE» в обход.
 */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly credentialMode: CredentialMode;
  /** Только для OWN: собственный partner-id. Для PLATFORM берётся общий. */
  readonly partnerId?: string;
  /** Только для OWN: путь к секретам партнёра в Vault. */
  readonly secretRef?: string;
  readonly platformApproved: boolean;
  readonly mcApproved: boolean;
  readonly suspended: boolean;
}

/** Транзакции разрешены только при двойном одобрении и без блокировки. */
export function isActive(t: Tenant): boolean {
  return !t.suspended && t.platformApproved && t.mcApproved;
}

/** Человекочитаемый статус из флагов. */
export function effectiveStatus(t: Tenant): TenantStatus {
  if (t.suspended) return TenantStatus.SUSPENDED;
  if (t.platformApproved && t.mcApproved) return TenantStatus.ACTIVE;
  if (t.platformApproved) return TenantStatus.PLATFORM_APPROVED;
  if (t.mcApproved) return TenantStatus.MC_APPROVED;
  return TenantStatus.PENDING;
}
