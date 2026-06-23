import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  randomToken,
  safeEqual,
  sha256hex,
} from '../../common/utils/crypto.util';
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
    this.logger.log(`Выпущен client '${clientId}' для tenant '${tenantId}'`);
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
    return c.tenantId;
  }

  async revoke(clientId: string): Promise<boolean> {
    const res = await this.repo.update({ clientId }, { revoked: true });
    const ok = (res.affected ?? 0) > 0;
    if (ok) this.logger.log(`Отозван client '${clientId}'`);
    return ok;
  }
}
