import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as forge from 'node-forge';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { MIN_TLS_VERSION } from '../../common/utils/tls';
import { McAgentProvider } from './mc-agent.provider';

/**
 * The real KMP-issued client certificate is weeks away, so everything here runs on
 * PKCS#12 bundles built in the spec — the same approach `p12.util.spec.ts` uses.
 */

const PASSWORD = 'pw';
const tmp: string[] = [];

function makeP12(cn: string, withCert = true): { file: string; der: Buffer } {
  const gen = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const key = forge.pki.privateKeyFromPem(gen.privateKey);
  const certs: forge.pki.Certificate[] = [];
  if (withCert) {
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(gen.publicKey);
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date('2020-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
    const attrs = [{ name: 'commonName', value: cn }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(key);
    certs.push(cert);
  }
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, certs, PASSWORD, {
    generateLocalKeyId: certs.length > 0,
    friendlyName: cn,
  });
  const der = Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
  const file = path.join(os.tmpdir(), `mc-mtls-${cn}-${Date.now()}.p12`);
  fs.writeFileSync(file, der);
  tmp.push(file);
  return { file, der };
}

const configWith = (over: Partial<GatewayConfig> = {}): GatewayConfig =>
  ({
    mtlsEnabled: false,
    mtlsCaPath: undefined,
    require: (k: string) => (over as Record<string, string>)[`_${k}`],
    ...over,
  }) as unknown as GatewayConfig;

const creds = (mtls?: McCredentials['mtls']): McCredentials =>
  ({
    consumerKey: 'ck',
    signingKeyPem: 'pem',
    partnerId: 'P',
    mtls,
  }) as McCredentials;

/** Options of a live https.Agent, for assertions. */
const optsOf = (a: unknown) =>
  (a as { options: Record<string, unknown> }).options;

describe('McAgentProvider', () => {
  let platform: { file: string };
  let tenantA: { der: Buffer };
  let tenantB: { der: Buffer };

  beforeAll(() => {
    platform = makeP12('PROD-XBS');
    tenantA = makeP12('tenant-a');
    tenantB = makeP12('tenant-b');
  }, 60_000);

  afterAll(() => {
    for (const f of tmp) fs.rmSync(f, { force: true });
  });

  const mtlsOf = (p12: Buffer, thumb: string): McCredentials['mtls'] => ({
    pfx: p12,
    passphrase: PASSWORD,
    thumbprintS256: thumb,
  });

  describe('disabled (sandbox and the global endpoints)', () => {
    it('returns one shared agent with no client certificate', () => {
      const p = new McAgentProvider(configWith());
      p.onModuleInit();

      const agent = p.agentFor(creds());
      expect(optsOf(agent).pfx).toBeUndefined();
      // Behaviour must be byte-identical to the single-agent era.
      expect(optsOf(agent).minVersion).toBe(MIN_TLS_VERSION);
      expect(optsOf(agent).maxSockets).toBe(50);
      expect(p.agentFor(creds())).toBe(agent);
      p.onApplicationShutdown();
    });
  });

  describe('enabled', () => {
    const enabled = () =>
      configWith({
        mtlsEnabled: true,
        _mtlsClientCertPath: platform.file,
        _mtlsClientCertPassword: PASSWORD,
      } as unknown as Partial<GatewayConfig>);

    it('presents the platform certificate on the shared agent', () => {
      const p = new McAgentProvider(enabled());
      p.onModuleInit();

      expect(optsOf(p.agentFor(creds())).pfx).toBeInstanceOf(Buffer);
      expect(p.clientCertStatus?.notAfter).toBe('2030-01-01');
      p.onApplicationShutdown();
    });

    it('refuses a keystore that carries no certificate', () => {
      const keyOnly = makeP12('no-cert', false);
      const p = new McAgentProvider(
        configWith({
          mtlsEnabled: true,
          _mtlsClientCertPath: keyOnly.file,
          _mtlsClientCertPassword: PASSWORD,
        } as unknown as Partial<GatewayConfig>),
      );

      expect(() => p.onModuleInit()).toThrow(/no certificate/);
    });

    it('gives a tenant with its own certificate its own agent, and reuses it', () => {
      const p = new McAgentProvider(enabled());
      p.onModuleInit();

      const shared = p.agentFor(creds());
      const a1 = p.agentFor(creds(mtlsOf(tenantA.der, 'thumb-a')));
      const a2 = p.agentFor(creds(mtlsOf(tenantA.der, 'thumb-a')));
      const b = p.agentFor(creds(mtlsOf(tenantB.der, 'thumb-b')));

      expect(a1).not.toBe(shared);
      expect(a1).toBe(a2); // cached by thumbprint
      expect(b).not.toBe(a1);
      // A per-tenant pool is deliberately smaller than the shared one.
      expect(optsOf(a1).maxSockets).toBe(16);
      p.onApplicationShutdown();
    });

    it('evicts the coldest agent at capacity and DESTROYS it (sockets would leak)', () => {
      const p = new McAgentProvider(enabled());
      p.onModuleInit();

      const first = p.agentFor(creds(mtlsOf(tenantA.der, 'thumb-0')));
      const destroy = jest.spyOn(first, 'destroy');
      // Fill well past MTLS_AGENT_CACHE_MAX (32).
      for (let i = 1; i <= 40; i++) {
        p.agentFor(creds(mtlsOf(tenantB.der, `thumb-${i}`)));
      }

      expect(destroy).toHaveBeenCalled();
      p.onApplicationShutdown();
    });

    it('destroys every agent on shutdown, not just the shared one', () => {
      const p = new McAgentProvider(enabled());
      p.onModuleInit();
      const shared = p.agentFor(creds());
      const tenant = p.agentFor(creds(mtlsOf(tenantA.der, 'thumb-x')));
      const spies = [
        jest.spyOn(shared, 'destroy'),
        jest.spyOn(tenant, 'destroy'),
      ];

      p.onApplicationShutdown();

      for (const s of spies) expect(s).toHaveBeenCalled();
    });
  });
});
