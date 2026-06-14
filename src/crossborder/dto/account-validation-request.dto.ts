import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/account-validations` → MC Account Validation API.
 * Проверка счёта получателя ДО платежа. Идёт через mcPassthroughPipe — валидируем
 * только критичные верхнеуровневые поля, остальное (accountDetails и пр.) MC
 * проверяет сам. `accountUri` обязателен у MC (objet { type, value }).
 */
export class AccountValidationRequestDto {
  @ApiProperty({
    description: 'Счёт получателя.',
    example: { type: 'IBAN', value: 'FR070331234567890123456' },
  })
  @IsObject()
  accountUri!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Тип сервиса: CES (Card Eligibility) | ASV (Account Status).',
  })
  @IsOptional()
  @IsString()
  requestType?: string;
}
