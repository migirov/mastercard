import { BadRequestException } from '@nestjs/common';
import { UuidParamPipe } from './uuid-param.pipe';

describe('UuidParamPipe', () => {
  const pipe = new UuidParamPipe();

  it('passes valid RFC-4122 UUIDs (v1–v5) through unchanged', () => {
    const v4 = '33000000-0000-4000-8000-000000000000';
    expect(pipe.transform(v4)).toBe(v4);
    // uppercase and real v1/v4/v5 — all accepted
    expect(pipe.transform('33ABCDEF-1234-4567-89AB-0123456789AB')).toBe(
      '33ABCDEF-1234-4567-89AB-0123456789AB',
    );
    // v1 UUID — MUST be accepted. A guard against "simplifying" to the built-in
    // ParseUUIDPipe({version:'4'}), which would wrongly reject a valid v1.
    expect(pipe.transform('a0eebc99-9c0b-11ec-82a8-0242ac130003')).toBe(
      'a0eebc99-9c0b-11ec-82a8-0242ac130003',
    );
  });

  // These are exactly what MC rejects with 062000 "Value contains invalid character":
  // version/variant nibbles = 0, or the literal docs placeholder with X, or non-hex.
  it.each([
    '33000000-0000-0000-0000-000000000000', // version=0 (our former demo id)
    '10000000-0000-0000-0000-000000082000', // version=0 (download demo id)
    '33000000-0000-4000-0000-000000000000', // variant=0
    '33XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX', // docs placeholder (X is non-hex)
    '33000000-0000-4000-8000-00000000000', // short last group (11)
    'not-a-uuid',
    '',
  ])('rejects malformed UUID %p with BadRequest', (bad) => {
    expect(() => pipe.transform(bad)).toThrow(BadRequestException);
  });

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
