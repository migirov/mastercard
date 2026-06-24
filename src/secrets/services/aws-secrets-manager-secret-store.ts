import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GetSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { GatewayConfig } from '../../config/gateway-config';
import { KeyMaterial, MerchantSecretBundle, SecretStore } from '../secret-store.types';

/**
 * Prod implementation of the secret store, backed by AWS Secrets Manager (the
 * host b24club-api runs on AWS). A tenant's `secretRef` is the secret name or
 * ARN; the secret value is a JSON document shaped like {@link MerchantSecretBundle}
 * (keys as base64-encoded .p12 — `signing.p12Base64` / `decryption.p12Base64`).
 *
 * Credentials/region come from the standard AWS provider chain (the IAM role on
 * ECS/EKS — the same mechanism the host already uses for S3/Cognito); an explicit
 * region can be passed via `secretStoreRegion`. Caching lives upstream in
 * OwnCredentialsProvider (cache-manager, TTL+LRU), so this store is stateless
 * apart from the lazily-built SDK client.
 *
 * Secret material is never written to logs.
 */
@Injectable()
export class AwsSecretsManagerSecretStore implements SecretStore {
  private readonly logger = new Logger(AwsSecretsManagerSecretStore.name);
  private client?: SecretsManagerClient;

  constructor(private readonly config: GatewayConfig) {}

  async getMerchantSecrets(secretRef: string): Promise<MerchantSecretBundle> {
    const raw = await this.read(secretRef);
    return this.parse(secretRef, raw);
  }

  /**
   * Lazily build the SDK client so that constructing this provider (the
   * SecretsModule instantiates it even in `local` mode) never needs AWS config —
   * region resolution is deferred to the first request.
   */
  private getClient(): SecretsManagerClient {
    if (!this.client) {
      const region = this.config.secretStoreRegion;
      this.client = new SecretsManagerClient(region ? { region } : {});
    }
    return this.client;
  }

  /** Fetch the raw secret string for a secretRef (name or ARN). */
  private async read(secretRef: string): Promise<string> {
    let res;
    try {
      res = await this.getClient().send(
        new GetSecretValueCommand({ SecretId: secretRef }),
      );
    } catch (e) {
      if (e instanceof ResourceNotFoundException) {
        // Misconfigured tenant (unknown ref) — caller-facing 404, not a 500.
        throw new NotFoundException(
          `secret '${secretRef}' not found in AWS Secrets Manager`,
        );
      }
      // Network / IAM / throttling — transient from the caller's POV. Log the
      // error class only (never the secret), surface a generic 503.
      this.logger.error(
        `AWS Secrets Manager read failed for '${secretRef}': ${(e as Error).name}`,
      );
      throw new ServiceUnavailableException('secret store is unavailable');
    }

    const value =
      res.SecretString ??
      (res.SecretBinary
        ? Buffer.from(res.SecretBinary as Uint8Array).toString('utf8')
        : undefined);
    if (!value) {
      throw new UnprocessableEntityException(`secret '${secretRef}' is empty`);
    }
    return value;
  }

  /** Parse + shape-validate the secret JSON into a MerchantSecretBundle. */
  private parse(secretRef: string, raw: string): MerchantSecretBundle {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      // Never log `raw` — it is secret material.
      throw new UnprocessableEntityException(
        `secret '${secretRef}' is not valid JSON`,
      );
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      throw new UnprocessableEntityException(
        `secret '${secretRef}' must be a JSON object`,
      );
    }
    const o = json as Record<string, unknown>;

    const bundle: MerchantSecretBundle = {
      consumerKey: this.str(secretRef, 'consumerKey', o.consumerKey),
      partnerId: this.str(secretRef, 'partnerId', o.partnerId),
      signing: this.keyMaterial(secretRef, 'signing', o.signing, true),
      encryptionCertPem: this.optStr(
        secretRef,
        'encryptionCertPem',
        o.encryptionCertPem,
      ),
      encryptionFingerprint: this.optStr(
        secretRef,
        'encryptionFingerprint',
        o.encryptionFingerprint,
      ),
      decryption: this.keyMaterial(secretRef, 'decryption', o.decryption, false),
    };
    return bundle;
  }

  private str(ref: string, field: string, v: unknown): string {
    if (typeof v !== 'string' || !v) {
      throw new UnprocessableEntityException(
        `secret '${ref}': field '${field}' must be a non-empty string`,
      );
    }
    return v;
  }

  private optStr(ref: string, field: string, v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined;
    return this.str(ref, field, v);
  }

  /** Validate a KeyMaterial object: password + exactly one of p12Base64 / p12Path. */
  private keyMaterial(
    ref: string,
    field: string,
    v: unknown,
    required: true,
  ): KeyMaterial;
  private keyMaterial(
    ref: string,
    field: string,
    v: unknown,
    required: false,
  ): KeyMaterial | undefined;
  private keyMaterial(
    ref: string,
    field: string,
    v: unknown,
    required: boolean,
  ): KeyMaterial | undefined {
    if (v === undefined || v === null) {
      if (required) {
        throw new UnprocessableEntityException(
          `secret '${ref}': field '${field}' is required`,
        );
      }
      return undefined;
    }
    if (typeof v !== 'object' || Array.isArray(v)) {
      throw new UnprocessableEntityException(
        `secret '${ref}': field '${field}' must be an object`,
      );
    }
    const k = v as Record<string, unknown>;
    const password = this.str(ref, `${field}.password`, k.password);
    const p12Base64 = this.optStr(ref, `${field}.p12Base64`, k.p12Base64);
    const p12Path = this.optStr(ref, `${field}.p12Path`, k.p12Path);
    if (!p12Base64 && !p12Path) {
      throw new UnprocessableEntityException(
        `secret '${ref}': field '${field}' needs p12Base64 or p12Path`,
      );
    }
    return { password, p12Base64, p12Path };
  }
}
