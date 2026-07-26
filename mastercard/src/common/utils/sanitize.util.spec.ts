import { clipForLog, stripCrlf } from './sanitize.util';

describe('sanitize.util', () => {
  describe('stripCrlf (header values)', () => {
    it('removes CR and LF entirely', () => {
      expect(stripCrlf('a\r\nb')).toBe('ab');
      expect(stripCrlf('x\rInjected: 1\ny')).toBe('xInjected: 1y');
    });

    it('leaves a clean value unchanged', () => {
      expect(stripCrlf('SANDBOX_1234567')).toBe('SANDBOX_1234567');
    });
  });

  describe('clipForLog (log values)', () => {
    it('replaces CR/LF with a space (not removed) to keep tokens separated', () => {
      expect(clipForLog('a\r\nb')).toBe('a  b');
    });

    it('maps null/undefined to "none"', () => {
      expect(clipForLog(null)).toBe('none');
      expect(clipForLog(undefined)).toBe('none');
    });

    it('truncates to the max length (default 80)', () => {
      expect(clipForLog('x'.repeat(200))).toHaveLength(80);
      expect(clipForLog('x'.repeat(200), 10)).toHaveLength(10);
    });

    // The webhook handler passes fields that are NOT declared in the DTO, so they survive the
    // Passthrough pipe with whatever JSON type the sender chose. Typing this `string` was a
    // compile-time fiction: a numeric `status` reached `.replace` and threw, turning an
    // endpoint documented as always-200 into a 500.
    it.each<[string, unknown, string]>([
      ['a number', 0, '0'],
      ['a boolean', false, 'false'],
      ['an object', { a: 1 }, '{"a":1}'],
      ['an array', [1, 2], '[1,2]'],
    ])('coerces %s instead of throwing', (_label, input, expected) => {
      expect(clipForLog(input)).toBe(expected);
    });

    it('survives an unserializable value (circular object)', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => clipForLog(circular)).not.toThrow();
    });

    it('still strips CR/LF after coercion (log injection via a non-string)', () => {
      expect(clipForLog({ s: 'a\nb' })).not.toContain('\n');
    });
  });
});
