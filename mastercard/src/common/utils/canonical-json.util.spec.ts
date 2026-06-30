import { stableStringify } from './canonical-json.util';

describe('stableStringify', () => {
  it('emits object keys in sorted order regardless of insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('two key-reordered but identical objects serialize identically (the fingerprint property)', () => {
    const a = {
      paymentrequest: {
        transaction_reference: 'TX',
        amount: { value: 10, currency: 'USD' },
      },
    };
    const b = {
      paymentrequest: {
        amount: { currency: 'USD', value: 10 },
        transaction_reference: 'TX',
      },
    };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('a genuinely different value still differs after canonicalization', () => {
    const a = { paymentrequest: { transaction_reference: 'TX', amount: 10 } };
    const b = { paymentrequest: { transaction_reference: 'TX', amount: 11 } };
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });

  it('preserves array element order (order is meaningful)', () => {
    expect(stableStringify({ xs: [3, 1, 2] })).toBe('{"xs":[3,1,2]}');
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('handles null, primitives, and nested structures', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify({ z: null, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"z":null}',
    );
  });
});
