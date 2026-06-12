import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Тело `POST /crossborder/address-validations` → MC Address Validation Service.
 * Плоское тело (без обёртки): `country` + `address` — оба обязательны у MC.
 * Идёт через mcPassthroughPipe (валидируем только формат критичных полей; всё
 * прочее MC проверяет сам). Адрес валидируется ДО платежа, чтобы он не отклонился
 * из-за неверного адреса получателя.
 */
export class AddressValidationRequestDto {
  @ApiProperty({ example: 'USA', description: 'ISO-страна получателя.' })
  @IsString()
  country!: string;

  @ApiProperty({
    example: '4 CLARK STREET, EVERETT, MA, 02149',
    description: 'Адрес одной строкой.',
  })
  @IsString()
  address!: string;
}
