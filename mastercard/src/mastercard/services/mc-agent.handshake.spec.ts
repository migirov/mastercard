import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as forge from 'node-forge';
import { GatewayConfig } from '../../config/gateway-config';
import { McCredentials } from '../../credentials/credentials.types';
import { McAgentProvider } from './mc-agent.provider';
import { asTlsHandshakeError } from './mc.errors';

/**
 * The only test that proves the client certificate is actually PRESENTED.
 *
 * Every other mTLS spec asserts on `agent.options` — that the pfx bytes were handed
 * to Node. That is not the same claim: a keystore Node cannot open, a chain it will
 * not send, or a TLS floor that rules out the negotiated version all leave the
 * options object looking perfect and the handshake dead. So this one runs a real
 * `https.createServer({ requestCert: true })` and asks the SERVER what it saw.
 *
 * The two failure paths are asserted through `asTlsHandshakeError`'s verdict rather
 * than a raw error code: the OpenSSL alert names drift between Node versions, and
 * pinning them here would make this suite fail on an upgrade for no real reason.
 * The verdict is the contract an operator actually reads.
 */

const PASSWORD = 'pw';
const tmp: string[] = [];

function tmpFile(name: string, content: string | Buffer): string {
  const file = path.join(os.tmpdir(), `mc-hs-${name}-${process.pid}`);
  fs.writeFileSync(file, content);
  tmp.push(file);
  return file;
}

function keyPair() {
  const gen = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    privateKey: forge.pki.privateKeyFromPem(gen.privateKey),
    publicKey: forge.pki.publicKeyFromPem(gen.publicKey),
    privateKeyPem: gen.privateKey,
  };
}

/** A self-signed certificate. SHA-256, because OpenSSL 3 refuses SHA-1 signatures. */
function selfSigned(
  kp: ReturnType<typeof keyPair>,
  cn: string,
  san = false,
): forge.pki.Certificate {
  const cert = forge.pki.createCertificate();
  cert.publicKey = kp.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: cn }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  if (san) {
    // Node verifies the hostname against the SAN and ignores a CN-only certificate,
    // so without this the positive test would fail with ERR_TLS_CERT_ALTNAME_INVALID.
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ]);
  }
  cert.sign(kp.privateKey, forge.md.sha256.create());
  return cert;
}

const configWith = (over: Record<string, unknown>): GatewayConfig =>
  ({
    mtlsEnabled: false,
    mtlsCaPath: undefined,
    require: (k: string) => over[`_${k}`],
    ...over,
  }) as unknown as GatewayConfig;

const creds = () =>
  ({
    consumerKey: 'ck',
    signingKeyPem: 'pem',
    partnerId: 'P',
  }) as McCredentials;

/** One request through the given agent; resolves the body, rejects the socket error. */
function get(agent: https.Agent, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { host: 'localhost', port, path: '/', agent },
      (res) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString()));
        res.on('end', () => resolve(body));
      },
    );
    req.on('error', reject);
  });
}

describe('McAgentProvider — real TLS handshake', () => {
  const CLIENT_CN = 'PROD XBS';
  /**
   * Two servers on purpose. Node reports a refused client certificate COMPLETELY
   * differently per protocol version — `ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED`
   * under 1.3, a bare `EPROTO` under 1.2 — and a classifier that only handles the
   * first would silently retry the second as a network blip. Both must produce the
   * same verdict, so both are exercised.
   */
  const servers: Record<string, { server: https.Server; port: number }> = {};
  let clientP12File: string;
  let serverCertFile: string;

  beforeAll(async () => {
    const serverKp = keyPair();
    const serverCert = selfSigned(serverKp, 'localhost', true);
    const clientKp = keyPair();
    const clientCert = selfSigned(clientKp, CLIENT_CN);

    serverCertFile = tmpFile(
      'server-ca.pem',
      forge.pki.certificateToPem(serverCert),
    );
    const p12 = forge.pkcs12.toPkcs12Asn1(
      clientKp.privateKey,
      [clientCert],
      PASSWORD,
      { generateLocalKeyId: true, friendlyName: CLIENT_CN },
    );
    clientP12File = tmpFile(
      'client.p12',
      Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'),
    );

    for (const [name, maxVersion] of [
      ['tls1.3', undefined],
      ['tls1.2', 'TLSv1.2'],
    ] as const) {
      const server = https.createServer(
        {
          key: serverKp.privateKeyPem,
          cert: forge.pki.certificateToPem(serverCert),
          requestCert: true,
          rejectUnauthorized: true,
          // Trust the client's self-signed certificate directly — the usual
          // stand-in for the Mastercard-issued chain.
          ca: [forge.pki.certificateToPem(clientCert)],
          ...(maxVersion ? { maxVersion } : {}),
        },
        (req, res) => {
          const peer = (
            req.socket as unknown as {
              getPeerCertificate(): { subject?: { CN?: string } };
            }
          ).getPeerCertificate();
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end(peer?.subject?.CN ?? '');
        },
      );
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      servers[name] = {
        server,
        port: (server.address() as { port: number }).port,
      };
    }
  }, 60_000);

  afterAll(async () => {
    for (const { server } of Object.values(servers)) {
      await new Promise<void>((r) => server.close(() => r()));
    }
    for (const f of tmp) fs.rmSync(f, { force: true });
  });

  it.each(['tls1.3', 'tls1.2'])(
    'presents the client certificate over %s — the server sees our CN',
    async (edge) => {
      const p = new McAgentProvider(
        configWith({
          mtlsEnabled: true,
          mtlsCaPath: serverCertFile,
          _mtlsClientCertPath: clientP12File,
          _mtlsClientCertPassword: PASSWORD,
        }),
      );
      p.onModuleInit();

      // Asserted from the SERVER's side: the certificate was not merely configured,
      // it crossed the wire and satisfied `rejectUnauthorized`.
      await expect(get(p.agentFor(creds()), servers[edge].port)).resolves.toBe(
        CLIENT_CN,
      );

      p.onApplicationShutdown();
    },
    30_000,
  );

  it.each(['tls1.3', 'tls1.2'])(
    'a rejected handshake over %s is blamed on OUR certificate, not on MC being down',
    async (edge) => {
      // mTLS off: we trust their certificate but present none, so the server rejects.
      const p = new McAgentProvider(configWith({ mtlsCaPath: serverCertFile }));
      p.onModuleInit();

      const err = await get(p.agentFor(creds()), servers[edge].port).catch(
        (e: unknown) => e,
      );
      const classified = asTlsHandshakeError(err, 'localhost');

      // The raw code differs per protocol version; the verdict must not.
      expect(classified?.reason).toBe('client-certificate');
      // Nothing was transmitted ⇒ a payment idempotency slot is released, not held.
      expect(classified?.sent).toBe(false);

      p.onApplicationShutdown();
    },
    30_000,
  );

  it('an unverifiable server certificate is classified as THEIRS', async () => {
    // Client certificate configured, but no trust anchor for the server's own
    // self-signed one — the mirror image of the failure above, and a different fix.
    const p = new McAgentProvider(
      configWith({
        mtlsEnabled: true,
        _mtlsClientCertPath: clientP12File,
        _mtlsClientCertPassword: PASSWORD,
      }),
    );
    p.onModuleInit();

    const err = await get(p.agentFor(creds()), servers['tls1.3'].port).catch(
      (e: unknown) => e,
    );
    const classified = asTlsHandshakeError(err, 'localhost');

    expect(classified?.reason).toBe('server-certificate');
    expect(classified?.message).toContain('MC_MTLS_CA_PATH');

    p.onApplicationShutdown();
  }, 30_000);

  it('a keystore that cannot be opened is named as such, not left as a network blip', async () => {
    // A tenant's own mTLS material comes from the SecretStore at request time, so a
    // wrong password there is NOT caught by the boot-time parse. Node throws it
    // synchronously out of createSecureContext with no `code` property at all.
    const agent = new https.Agent({
      pfx: fs.readFileSync(clientP12File),
      passphrase: 'wrong',
    });

    const err = await get(agent, servers['tls1.3'].port).catch(
      (e: unknown) => e,
    );

    expect(asTlsHandshakeError(err, 'localhost')?.reason).toBe(
      'client-certificate',
    );
    agent.destroy();
  }, 30_000);
});
