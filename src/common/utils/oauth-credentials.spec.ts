import { parseClientCredentials } from './oauth-credentials';

const basic = (raw: string) =>
  `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;

describe('parseClientCredentials', () => {
  it('prefers the Basic header over the body (closes the throttle-bucket bypass)', () => {
    // Attacker holds real creds in Basic but puts a junk client_id in the body:
    // the identity (and thus the rate-limit bucket) must come from Basic.
    expect(
      parseClientCredentials({ client_id: 'bob' }, basic('alice:s3cret')),
    ).toEqual({ clientId: 'alice', clientSecret: 's3cret' });
  });

  it('falls through to the body when the Basic client_id is empty (":secret")', () => {
    expect(
      parseClientCredentials(
        { client_id: 'bob', client_secret: 'x' },
        basic(':secret'),
      ),
    ).toEqual({ clientId: 'bob', clientSecret: 'x' });
  });

  it('falls through to the body on a malformed Basic header (no throw)', () => {
    expect(
      parseClientCredentials(
        { client_id: 'bob', client_secret: 'x' },
        'Basic !!!notbase64',
      ),
    ).toEqual({ clientId: 'bob', clientSecret: 'x' });
  });

  it('ignores a non-Basic Authorization header and uses the body', () => {
    expect(
      parseClientCredentials(
        { client_id: 'x', client_secret: 'y' },
        'Bearer abc',
      ),
    ).toEqual({ clientId: 'x', clientSecret: 'y' });
  });

  it('reads credentials from the body when no auth header is present', () => {
    expect(
      parseClientCredentials({ client_id: 'x', client_secret: 'y' }, undefined),
    ).toEqual({
      clientId: 'x',
      clientSecret: 'y',
    });
  });

  it('returns a body client_id with undefined secret when the secret is absent', () => {
    expect(parseClientCredentials({ client_id: 'x' }, undefined)).toEqual({
      clientId: 'x',
      clientSecret: undefined,
    });
  });

  it('ignores non-string body fields', () => {
    expect(
      parseClientCredentials(
        { client_id: 123 as unknown as string },
        undefined,
      ),
    ).toEqual({});
  });

  it('returns {} when nothing is provided', () => {
    expect(parseClientCredentials(undefined, undefined)).toEqual({});
  });
});
