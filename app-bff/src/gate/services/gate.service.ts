import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { matchSharedToken } from '../../common/utils/crypto.util';
import { GateProof, signGateProof } from '../../common/utils/gate-proof.util';

/**
 * Verifies the UI access-gate password, server-side.
 *
 * This exists so the password never reaches the browser. It used to be a module-level constant in
 * `masrtercard-front/src/components/PasswordGate.jsx`, which Vite inlined into the built bundle —
 * i.e. it shipped inside the published frontend image and was readable by anyone who could load
 * the app. The gate screen is unchanged; only the comparison moved here.
 *
 * `matchSharedToken` is reused deliberately rather than writing a new comparison: it hashes BOTH
 * sides before `timingSafeEqual` (so the early length-return cannot leak the secret's length) and
 * it fails closed on an unconfigured secret. Both properties are exactly what is wanted here.
 *
 * A service rather than a few inline lines in the controller purely so the fail-closed invariant
 * can be pinned by a spec without standing up a Nest test module.
 */
@Injectable()
export class GateService {
  constructor(private readonly config: AppConfig) {}

  /**
   * `true` only if a password is configured AND the presented value matches it exactly.
   *
   * No trimming: a pasted value with a stray trailing space is a wrong password, not a match.
   * Trimming would silently widen the accepted set, and the operator who set the variable with a
   * trailing space would never find out.
   */
  verify(password: string): boolean {
    return matchSharedToken(password, this.config.demoGatePassword);
  }

  /**
   * Mint the proof both BFFs require as their second auth factor.
   *
   * Call ONLY after `verify` returned true — signing here is unconditional, exactly so that the
   * password check and the signing step stay separately testable.
   */
  issueProof(): GateProof {
    return signGateProof(
      this.config.demoGateSecret,
      this.config.demoGateTtlHours * 3600,
    );
  }
}
