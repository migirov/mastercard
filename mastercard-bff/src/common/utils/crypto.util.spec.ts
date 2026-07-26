import {
  matchSharedToken,
  safeEqual,
  safeTokenEqual,
  sha256hex,
} from './crypto.util';

describe('sha256hex', () => {
  it('produces the known digest of the empty string', () => {
    expect(sha256hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('safeEqual', () => {
  it('matches identical strings and rejects different ones', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  // The reason safeTokenEqual hashes first: this primitive cannot compare unequal lengths
  // without returning early, which is exactly the length leak we hash to avoid.
  it('returns false on differing lengths without throwing', () => {
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
  });
});

describe('safeTokenEqual', () => {
  it('compares values of different lengths safely', () => {
    expect(safeTokenEqual('a', 'a')).toBe(true);
    expect(safeTokenEqual('a', 'a-much-longer-secret')).toBe(false);
  });
});

describe('matchSharedToken — fail closed', () => {
  it('accepts the configured token', () => {
    expect(matchSharedToken('tok', 'tok')).toBe(true);
  });

  it.each([
    ['secret unset', 'tok', undefined],
    ['secret empty', 'tok', ''],
    ['header absent', undefined, 'tok'],
    ['header empty', '', 'tok'],
    ['both empty', '', ''],
  ])('denies when %s', (_label, provided, expected) => {
    expect(matchSharedToken(provided, expected)).toBe(false);
  });

  // Express hands over an array when a header is repeated. String(['a','b']) is 'a,b', which
  // must not accidentally equal a configured secret — assert it simply never matches here.
  it('does not match a repeated header smuggling the value in a list', () => {
    expect(matchSharedToken(['tok', 'other'], 'tok')).toBe(false);
  });
});
