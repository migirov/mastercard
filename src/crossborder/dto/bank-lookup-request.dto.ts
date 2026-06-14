import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Тело `POST /crossborder/bank-lookups` → MC Bank Information Lookup API.
 * Поиск реквизитов банка получателя для платежа. Обёртка `bank`
 * ({ name?, branchName?, country, bic?, address? }). Идёт через mcPassthroughPipe —
 * валидируем только наличие/тип обёртки, остальное MC проверяет сам.
 */
export class BankLookupRequestDto {
  @ApiProperty({
    description: 'Данные банка (обёртка bank).',
    example: {
      country: 'GBR',
      name: 'Bank of ...',
      bic: { type: null, value: null },
    },
  })
  @IsObject()
  bank!: Record<string, unknown>;
}
