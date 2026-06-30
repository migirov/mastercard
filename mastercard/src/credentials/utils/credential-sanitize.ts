import { Logger, UnprocessableEntityException } from '@nestjs/common';

/**
 * Pure boundary guards for credential inputs that flow into Mastercard URLs /
 * secret-store key paths. Extracted from CredentialsService so both the PLATFORM
 * and OWN providers share one definition (issue #14).
 *
 * Failures are "tenant is not configured", NOT a server crash: throw 422
 * (UnprocessableEntity), not a raw Error (→ 500 + alerting noise). Sensitive
 * detail (the offending value, tenant id) goes to the server log only — the
 * client message stays generic.
 */
const logger = new Logger('CredentialSanitize');

// partnerId goes into the MC request URL path → strict ALLOWLIST (not a denylist:
// a denylist easily lets through control bytes / `;@:&=` / exotic unicode). Real
// MC partner-ids are alphanumeric + `_-.` (e.g. SANDBOX_1234567). Applied to the
// partnerId from a SecretStore bundle too (it does not pass DTO validation).
const SAFE_PARTNER_ID = /^[A-Za-z0-9._-]{1,64}$/;

// secretRef is an AWS Secrets Manager secret name or ARN passed to GetSecretValue →
// the same key-confusion guard at the boundary (the DTO only covers admin-create;
// seeds / other paths construct a tenant directly). The charset is the AWS-allowed set
// (name: [A-Za-z0-9/_+=.@-]; ARN adds `:`); `/` is allowed (name hierarchy) but `..`
// segments are not (checked explicitly).
const SAFE_SECRET_REF = /^[A-Za-z0-9._/+=@:-]{1,256}$/;

/** Asserts partnerId is set and safe for a URL path (strict allowlist). */
export function safePartnerId(
  id: string | undefined,
  tenantId: string,
): string {
  if (!id) {
    logger.error(`tenant '${tenantId}': partnerId is not set`);
    throw new UnprocessableEntityException('partnerId is not set');
  }
  // The allowlist already excludes `/`, so a `..` segment is impossible; we still
  // check `..` explicitly in case the charset is ever widened.
  if (!SAFE_PARTNER_ID.test(id) || id.includes('..')) {
    logger.error(`tenant '${tenantId}': invalid partnerId`);
    throw new UnprocessableEntityException('invalid partnerId');
  }
  return id;
}

/** Asserts secretRef is safe as a secret-store key path (anti-traversal). */
export function safeSecretRef(ref: string, tenantId: string): string {
  if (!SAFE_SECRET_REF.test(ref) || ref.includes('..')) {
    logger.error(`tenant '${tenantId}': invalid secretRef`);
    throw new UnprocessableEntityException('invalid secretRef');
  }
  return ref;
}
