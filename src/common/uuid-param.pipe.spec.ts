import { BadRequestException } from '@nestjs/common';
import { UuidParamPipe } from './uuid-param.pipe';

describe('UuidParamPipe', () => {
  const pipe = new UuidParamPipe();

  it('passes valid RFC-4122 UUIDs (v1–v5) through unchanged', () => {
    const v4 = '33000000-0000-4000-8000-000000000000';
    expect(pipe.transform(v4)).toBe(v4);
    // верхний регистр и реальные v1/v4/v5 — все принимаются
    expect(pipe.transform('33ABCDEF-1234-4567-89AB-0123456789AB')).toBe(
      '33ABCDEF-1234-4567-89AB-0123456789AB',
    );
    // v1 UUID — ДОЛЖЕН приниматься. Это страховка от «упрощения» до встроенного
    // ParseUUIDPipe({version:'4'}), который валидный v1 ошибочно отверг бы.
    expect(pipe.transform('a0eebc99-9c0b-11ec-82a8-0242ac130003')).toBe(
      'a0eebc99-9c0b-11ec-82a8-0242ac130003',
    );
  });

  // Именно эти MC отвергает с 062000 "Value contains invalid character":
  // ниблы версии/варианта = 0, либо буквальный плейсхолдер доки с X, либо не-hex.
  it.each([
    '33000000-0000-0000-0000-000000000000', // version=0 (наш прежний демо-id)
    '10000000-0000-0000-0000-000000082000', // version=0 (download демо-id)
    '33000000-0000-4000-0000-000000000000', // variant=0
    '33XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX', // плейсхолдер доки (X — не hex)
    '33000000-0000-4000-8000-00000000000', // короткая последняя группа (11)
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
