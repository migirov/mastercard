import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  randomToken,
  safeEqual,
  sha256hex,
} from '../../common/utils/crypto.util';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { OAuthClientEntity } from '../entities/oauth-client.entity';

/** Dummy hash used to equalize timing when client_id is not found. */
const DUMMY_HASH = sha256hex('');

/**
 * Registry of OAuth2 clients backed by PostgreSQL. The secret is stored only as
 * a hash; the raw value is shown once at issuance.
 */
@Injectable()
export class ClientRegistry {
  private readonly logger = new Logger(ClientRegistry.name);

  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly repo: Repository<OAuthClientEntity>,
    private readonly tenants: TenantRegistry,
  ) {}

  /** Issue a client for a partner. Returns the raw secret ONCE. */
  async issue(
    tenantId: string,
  ): Promise<{ clientId: string; clientSecret: string }> {
    const clientId = `mc_${randomToken(9)}`;
    const clientSecret = randomToken(24);
    // We hash with SHA-256, NOT bcrypt/argon2 (which the docs recommend for PASSWORDS):
    // client_secret is 24 bytes (~192 bits) of CSPRNG entropy, not a human password.
    // Brute-force / rainbow tables, against which a slow salted KDF is needed, are
    // computationally infeasible on a 192-bit random token, and argon2 would add tens
    // of ms of latency to EVERY token validation with no benefit. Protection against a
    // hash leak = token entropy; against timing = safeEqual + dummy-hash in validate().
    await this.repo.save(
      this.repo.create({
        clientId,
        tenantId,
        secretHash: sha256hex(clientSecret),
        revoked: false,
      }),
    );
    this.logger.log(`Issued client '${clientId}' for tenant '${tenantId}'`);
    return { clientId, clientSecret };
  }

  /** Validate a client_id/secret pair. Returns tenantId or null. */
  async validate(
    clientId: string,
    clientSecret: string,
  ): Promise<string | null> {
    const c = await this.repo.findOne({ where: { clientId } });
    // The hash comparison is ALWAYS performed (against timing enumeration of client_id).
    const providedHash = sha256hex(clientSecret);
    const targetHash = c && !c.revoked ? c.secretHash : DUMMY_HASH;
    const match = safeEqual(targetHash, providedHash);
    if (!c || c.revoked || !match) return null;

    // Suspension is checked AFTER the constant-time comparison, so it adds no timing signal:
    // the extra query only runs once the caller has already proven it holds the secret.
    // Without this a suspended tenant keeps minting fresh 15-minute tokens indefinitely —
    // revoking the client is a separate admin action that an operator may not think to take.
    //
    // `suspended` only, deliberately NOT isActive(): a tenant awaiting dual approval SHOULD
    // authenticate and then get a clear 403 from resolveActive on each business call. Denying
    // the token would surface as `invalid_client`, which is misleading and breaks onboarding.
    try {
      const tenant = await this.tenants.get(c.tenantId);
      if (tenant.suspended) {
        this.logger.warn(
          `Token denied for client '${clientId}': tenant '${c.tenantId}' is suspended`,
        );
        return null;
      }
    } catch {
      // A client whose tenant no longer exists is not a 500 — it is simply invalid.
      this.logger.warn(
        `Token denied for client '${clientId}': tenant '${c.tenantId}' not found`,
      );
      return null;
    }
    return c.tenantId;
  }

  async revoke(clientId: string): Promise<boolean> {
    const res = await this.repo.update({ clientId }, { revoked: true });
    const ok = (res.affected ?? 0) > 0;
    if (ok) this.logger.log(`Revoked client '${clientId}'`);
    return ok;
  }
}
