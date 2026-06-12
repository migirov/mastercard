import { BadRequestException } from '@nestjs/common';
import { SafeIdPipe } from './safe-id.pipe';

describe('SafeIdPipe', () => {
  const pipe = new SafeIdPipe();

  it('passes valid identifiers through unchanged', () => {
    expect(pipe.transform('pen-4000456083300435022162028')).toBe(
      'pen-4000456083300435022162028',
    );
    expect(pipe.transform('08POC342598033X')).toBe('08POC342598033X');
  });

  it.each(['', 'a/b', 'a\\b', 'a b', 'x..y', '..'])(
    'rejects unsafe value %p with BadRequest',
    (bad) => {
      expect(() => pipe.transform(bad)).toThrow(BadRequestException);
    },
  );

  // ?ref[x]=1 → объект, ?ref=a&ref=b → массив; не-строка не должна ронять pipe в 500.
  it.each([
    ['array', ['a', 'b']],
    ['object', { x: '1' }],
    ['number', 42],
    ['null', null],
    ['undefined', undefined],
  ])('rejects non-string %s with BadRequest (no crash)', (_label, bad) => {
    expect(() => pipe.transform(bad)).toThrow(BadRequestException);
  });
});
