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
  });
});
