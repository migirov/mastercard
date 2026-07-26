import { IBAN_RE, isValidIban, normalizeIban } from './iban.util';

describe('normalizeIban', () => {
  it('strips whitespace and upper-cases', () => {
    expect(normalizeIban(' de89 3704 0044 0532 0130 00 ')).toBe(
      'DE89370400440532013000',
    );
  });
});

describe('isValidIban — checksum, not just shape', () => {
  // The IBANs actually seeded into the demo invoices. If mod-97 were implemented wrongly
  // these would start reading as invalid in the demo fallback, which is exactly the
  // regression this suite exists to catch.
  it.each([
    'DE89370400440532013000',
    'GB29NWBK60161331926819',
    'NL91ABNA0417164300',
    'IL620108000000099999999',
  ])('accepts the seeded IBAN %s', (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  /**
   * Mastercard's own sandbox test IBAN, seeded at app-bff/src/seed/seed-data.ts and chosen
   * so the demo exercises a genuine LIVE validation. It is 23 characters where FR requires
   * 27, and its mod-97 is 85 — i.e. checksum-invalid BY DESIGN.
   *
   * This is asserted deliberately: under `live` mode Mastercard answers and nothing changes,
   * but if the gateway is unreachable the demo path will now report it as not valid. That is
   * the honest outcome. Do NOT relax the checksum to make this one fixture look nicer.
   */
  it('reports the MC sandbox test IBAN FR07... as checksum-invalid (by design)', () => {
    expect(IBAN_RE.test('FR070331234567890123456')).toBe(true);
    expect(isValidIban('FR070331234567890123456')).toBe(false);
  });

  // The whole point of the change: structure alone used to be enough to claim "valid".
  it('rejects a well-shaped but made-up account (structure passes, checksum does not)', () => {
    expect(IBAN_RE.test('XX00AAAAAAAAAAAAAAA')).toBe(true);
    expect(isValidIban('XX00AAAAAAAAAAAAAAA')).toBe(false);
  });

  it('rejects a transposed digit in an otherwise valid IBAN', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('DE89370400440532013百')).toBe(false);
    expect(isValidIban('DE98370400440532013000')).toBe(false);
  });

  it.each([
    ['too short', 'DE89'],
    ['lower-case (caller must normalize first)', 'de89370400440532013000'],
    ['embedded spaces (caller must normalize first)', 'DE89 3704 0044 0532'],
    ['non-alphanumeric', 'DE89-3704-0044-0532-0130-00'],
    ['empty', ''],
  ])('rejects %s', (_label, iban) => {
    expect(isValidIban(iban)).toBe(false);
  });
});
