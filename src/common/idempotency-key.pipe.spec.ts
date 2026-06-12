import { BadRequestException } from '@nestjs/common';
import { IdempotencyKeyPipe } from './idempotency-key.pipe';

describe('IdempotencyKeyPipe', () => {
  const pipe = new IdempotencyKeyPipe();

  it('passes a valid key through unchanged', () => {
    expect(pipe.transform('a1b2c3d4-0000-1111-2222-aabbccddeeff')).toBe(
      'a1b2c3d4-0000-1111-2222-aabbccddeeff',
    );
    expect(pipe.transform('order:42.payment_1')).toBe('order:42.payment_1');
    // Точки разрешены (charset [\w.\-:]) — в отличие от SafeIdPipe здесь нет
    // path-семантики, ключ идёт в KV, а не в URL. '..' — валидный ключ.
    expect(pipe.transform('..')).toBe('..');
  });

  it('passes undefined through (header optional → no idempotency)', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('rejects an over-long key (>128) — would overflow kv_store.key', () => {
    expect(() => pipe.transform('x'.repeat(129))).toThrow(BadRequestException);
  });

  // Пустой заголовок и небезопасный charset → 400 (не молчаливый no-op).
  it.each(['', 'has space', 'slash/here', 'semi;colon', 'uniçode', 'a#b'])(
    'rejects unsafe value %p',
    (bad) => {
      expect(() => pipe.transform(bad)).toThrow(BadRequestException);
    },
  );

  // ?дублированный заголовок / инъекция объекта не должны ронять pipe в 500.
  it.each([
    ['array', ['a', 'b']],
    ['object', { x: '1' }],
    ['number', 42],
    ['null', null],
  ])('rejects non-string %s without crashing', (_label, bad) => {
    expect(() => pipe.transform(bad)).toThrow(BadRequestException);
  });
});
