import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

// Mock the AWS SDK with a self-contained factory (no out-of-scope refs → no TDZ).
// `__send` is exposed back to the test so it can drive responses per-case; the
// mocked ResourceNotFoundException is the same class the store's `instanceof` checks.
jest.mock('@aws-sdk/client-secrets-manager', () => {
  const send = jest.fn();
  class ResourceNotFoundException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'ResourceNotFoundException';
    }
  }
  return {
    __send: send,
    SecretsManagerClient: jest.fn().mockImplementation(() => ({ send })),
    GetSecretValueCommand: jest.fn().mockImplementation((input) => ({ input })),
    ResourceNotFoundException,
  };
});

import * as awsSdk from '@aws-sdk/client-secrets-manager';
import { GatewayConfig } from '../../config/gateway-config';
import { AwsSecretsManagerSecretStore } from './aws-secrets-manager-secret-store';

const send = (awsSdk as unknown as { __send: jest.Mock }).__send;
const ClientCtor = awsSdk.SecretsManagerClient as unknown as jest.Mock;
const CommandCtor = awsSdk.GetSecretValueCommand as unknown as jest.Mock;
const ResourceNotFoundException = (
  awsSdk as unknown as { ResourceNotFoundException: new (m?: string) => Error }
).ResourceNotFoundException;

const SECRET_REF = 'mc/own/own-sandbox';

const validBundle = {
  consumerKey: 'ck',
  partnerId: 'SANDBOX_1234567',
  signing: { p12Base64: 'AAAA', password: 'pw' },
  encryptionCertPem: '-----BEGIN CERTIFICATE-----',
  encryptionFingerprint: 'a'.repeat(64),
  decryption: { p12Base64: 'BBBB', password: 'pw2' },
};

function store(region?: string): AwsSecretsManagerSecretStore {
  const config = { secretStoreRegion: region } as unknown as GatewayConfig;
  return new AwsSecretsManagerSecretStore(config);
}

beforeEach(() => {
  send.mockReset();
  ClientCtor.mockClear();
  CommandCtor.mockClear();
});

describe('AwsSecretsManagerSecretStore', () => {
  it('reads + parses a SecretString JSON bundle', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify(validBundle) });

    const bundle = await store().getMerchantSecrets(SECRET_REF);

    expect(bundle).toEqual({
      consumerKey: 'ck',
      partnerId: 'SANDBOX_1234567',
      signing: { password: 'pw', p12Base64: 'AAAA', p12Path: undefined },
      encryptionCertPem: '-----BEGIN CERTIFICATE-----',
      encryptionFingerprint: 'a'.repeat(64),
      decryption: { password: 'pw2', p12Base64: 'BBBB', p12Path: undefined },
    });
    // GetSecretValue called with the ref as SecretId.
    expect(CommandCtor).toHaveBeenCalledWith({ SecretId: SECRET_REF });
  });

  it('decodes a SecretBinary payload', async () => {
    send.mockResolvedValue({
      SecretBinary: new TextEncoder().encode(JSON.stringify(validBundle)),
    });
    const bundle = await store().getMerchantSecrets(SECRET_REF);
    expect(bundle.consumerKey).toBe('ck');
  });

  it('passes an explicit region to the client, else lets the SDK resolve it', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify(validBundle) });

    await store('eu-west-1').getMerchantSecrets(SECRET_REF);
    expect(ClientCtor).toHaveBeenCalledWith({ region: 'eu-west-1' });

    ClientCtor.mockClear();
    await store().getMerchantSecrets(SECRET_REF);
    expect(ClientCtor).toHaveBeenCalledWith({});
  });

  it('omits the optional decryption key when absent', async () => {
    const { decryption, ...noDecrypt } = validBundle;
    void decryption;
    send.mockResolvedValue({ SecretString: JSON.stringify(noDecrypt) });
    const bundle = await store().getMerchantSecrets(SECRET_REF);
    expect(bundle.decryption).toBeUndefined();
  });

  it('maps ResourceNotFound to 404', async () => {
    send.mockRejectedValue(new ResourceNotFoundException('nope'));
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps a transient AWS error to 503 without leaking detail', async () => {
    send.mockRejectedValue(new Error('AccessDeniedException: ...'));
    const p = store().getMerchantSecrets(SECRET_REF);
    await expect(p).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(p).rejects.toThrow(/unavailable/);
  });

  it('rejects an empty secret', async () => {
    send.mockResolvedValue({});
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects invalid JSON', async () => {
    send.mockResolvedValue({ SecretString: 'not-json{' });
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it('rejects a non-object JSON', async () => {
    send.mockResolvedValue({ SecretString: '["array"]' });
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toThrow(
      /must be a JSON object/,
    );
  });

  it('rejects a bundle missing consumerKey', async () => {
    const { consumerKey, ...bad } = validBundle;
    void consumerKey;
    send.mockResolvedValue({ SecretString: JSON.stringify(bad) });
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toThrow(
      /consumerKey/,
    );
  });

  it('rejects a bundle missing the signing key', async () => {
    const { signing, ...bad } = validBundle;
    void signing;
    send.mockResolvedValue({ SecretString: JSON.stringify(bad) });
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toThrow(
      /signing.*required/,
    );
  });

  it('rejects signing without p12 material', async () => {
    const bad = { ...validBundle, signing: { password: 'pw' } };
    send.mockResolvedValue({ SecretString: JSON.stringify(bad) });
    await expect(store().getMerchantSecrets(SECRET_REF)).rejects.toThrow(
      /p12Base64 or p12Path/,
    );
  });
});
