import { asNumber, asString, firstDefined, pick } from './parse.util';

describe('parse.util', () => {
  describe('pick', () => {
    it('reads a nested path', () => {
      expect(pick({ a: { b: { c: 1 } } }, 'a', 'b', 'c')).toBe(1);
    });
    it('returns undefined on a missing or non-object path', () => {
      expect(pick({ a: 1 }, 'a', 'b')).toBeUndefined();
      expect(pick(null, 'a')).toBeUndefined();
    });
  });

  describe('firstDefined', () => {
    it('returns the first defined candidate', () => {
      expect(firstDefined({ b: 2 }, [['a'], ['b'], ['c']])).toBe(2);
    });
    it('returns undefined when none match', () => {
      expect(firstDefined({}, [['a'], ['b']])).toBeUndefined();
    });
  });

  describe('asNumber', () => {
    it('coerces numeric strings and numbers', () => {
      expect(asNumber('3.5')).toBe(3.5);
      expect(asNumber(7)).toBe(7);
    });
    it('rejects non-numeric and non-finite', () => {
      expect(asNumber('x')).toBeUndefined();
      expect(asNumber(NaN)).toBeUndefined();
      expect(asNumber(Infinity)).toBeUndefined();
    });
  });

  describe('asString', () => {
    it('passes non-empty strings and finite numbers', () => {
      expect(asString('hi')).toBe('hi');
      expect(asString(3)).toBe('3');
    });
    it('rejects empty strings and non-finite numbers', () => {
      expect(asString('')).toBeUndefined();
      expect(asString(NaN)).toBeUndefined();
      expect(asString(Infinity)).toBeUndefined();
    });
  });
});
