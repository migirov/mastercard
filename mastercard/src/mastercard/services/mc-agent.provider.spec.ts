import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as forge from 'node-forge';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { MIN_TLS_VERSION } from '../../common/utils/tls';
import { McAgentProvider } from './mc-agent.provider';
import { TenantMtlsUnavailableError } from './mc.errors';

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
      expect(a1).toBe(a2); // cached by keystore content
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
      // Each entry must be DISTINCT MATERIAL, not just a distinct label: the cache
      // is keyed on sha256(pfx + passphrase). Varying the passphrase is enough and
      // is genuine — the same bytes under another passphrase are another keystore.
      // (Building 40 real PKCS#12 bundles would add ~40 RSA keygens to the suite.)
      for (let i = 1; i <= 40; i++) {
        p.agentFor(
          creds({
            pfx: tenantB.der,
            passphrase: `${PASSWORD}-${i}`,
            thumbprintS256: `thumb-${i}`,
          }),
        );
      }

      expect(destroy).toHaveBeenCalled();
      p.onApplicationShutdown();
    });

    it('keys the cache on the certificate BYTES, not on the supplied thumbprint', () => {
      const p = new McAgentProvider(enabled());
      p.onModuleInit();

      // Two DIFFERENT keystores arriving with the SAME thumbprint string. That
      // string comes from a merchant secret bundle; if it were the cache key, the
      // second tenant would be handed the first one's agent and would present the
      // wrong organisation's certificate to Mastercard.
      const a = p.agentFor(creds(mtlsOf(tenantA.der, 'same-string')));
      const b = p.agentFor(creds(mtlsOf(tenantB.der, 'same-string')));
      expect(a).not.toBe(b);

      // Same bytes, same passphrase → still one agent (the cache must still work).
      expect(p.agentFor(creds(mtlsOf(tenantA.der, 'a-different-string')))).toBe(
        a,
      );
      p.onApplicationShutdown();
    });

    it('gives per-tenant agents the same server trust anchors as the shared one', () => {
      // `ca` says which SERVER certificates we accept — a property of the endpoint,
      // not of whose client certificate we present. Dropping it for tenant agents
      // would fail verification for exactly the tenants that have their own cert.
      const caFile = path.join(os.tmpdir(), `mc-ca-${Date.now()}.pem`);
      fs.writeFileSync(
        caFile,
        '-----BEGIN CERTIFICATE-----\nAA==\n-----END CERTIFICATE-----\n',
      );
      tmp.push(caFile);
      const p = new McAgentProvider(
        configWith({
          mtlsEnabled: true,
          mtlsCaPath: caFile,
          _mtlsClientCertPath: platform.file,
          _mtlsClientCertPassword: PASSWORD,
        } as unknown as Partial<GatewayConfig>),
      );
      p.onModuleInit();

      const tenant = p.agentFor(creds(mtlsOf(tenantA.der, 'thumb-ca')));
      expect(optsOf(tenant).ca).toEqual(optsOf(p.agentFor(creds())).ca);
      expect(optsOf(tenant).ca).toBeDefined();
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

  /**
   * Nothing populates `creds.mtls` yet — no secret bundle carries a client
   * certificate — so every tenant currently falls through to the shared agent.
   * That is harmless on sandbox, where no certificate is presented at all, and
   * becomes an identity leak the moment mTLS is switched on: an OWN tenant would
   * authenticate its own partner account with the PLATFORM's certificate.
   *
   * The guard cannot fire on any configuration that exists today. It exists so the
   * day the configuration first becomes dangerous is loud rather than silent.
   */
  describe('an OWN tenant may not borrow the platform certificate', () => {
    const onMtfHost = (over: Record<string, unknown> = {}) =>
      configWith({
        mtlsEnabled: true,
        mtlsRequiredForHost: true,
        baseUrl: 'https://mtf.api.xbs.mastercard.eu',
        // Matches the `creds()` helper — these ARE the platform's identity.
        consumerKey: 'ck',
        partnerId: 'P',
        _mtlsClientCertPath: platform.file,
        _mtlsClientCertPassword: PASSWORD,
        ...over,
      } as unknown as Partial<GatewayConfig>);

    const ownCreds = () =>
      ({
        consumerKey: 'own-key',
        signingKeyPem: 'pem',
        partnerId: 'OWN_PARTNER',
      }) as McCredentials;

    it('refuses, rather than silently presenting the platform certificate', () => {
      const p = new McAgentProvider(onMtfHost());
      p.onModuleInit();

      expect(() => p.agentFor(ownCreds())).toThrow(TenantMtlsUnavailableError);
      // Nothing was transmitted, so a payment idempotency slot is released.
      try {
        p.agentFor(ownCreds());
      } catch (e) {
        expect((e as TenantMtlsUnavailableError).sent).toBe(false);
      }
      p.onApplicationShutdown();
    });

    it('does not block the PLATFORM tenant on the same host', () => {
      const p = new McAgentProvider(onMtfHost());
      p.onModuleInit();

      expect(() => p.agentFor(creds())).not.toThrow();
      p.onApplicationShutdown();
    });

    it('does not block an OWN tenant that brought its own certificate', () => {
      const p = new McAgentProvider(onMtfHost());
      p.onModuleInit();

      const own = { ...ownCreds(), mtls: mtlsOf(tenantA.der, 'own') };
      expect(() => p.agentFor(own as McCredentials)).not.toThrow();
      p.onApplicationShutdown();
    });

    it('stays inert where Mastercard does not require a certificate', () => {
      // Sandbox and the .com endpoints: no certificate is presented by anyone, so
      // there is no identity to borrow and nothing to refuse.
      const p = new McAgentProvider(
        onMtfHost({ mtlsRequiredForHost: false, mtlsEnabled: false }),
      );
      p.onModuleInit();

      expect(() => p.agentFor(ownCreds())).not.toThrow();
      p.onApplicationShutdown();
    });
  });
});
