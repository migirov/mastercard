import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Тело `POST /crossborder/rfi/requests/:requestId` → MC RFI Update Request API.
 * Ответ Customer'а на RFI-запрос. Обёртка `updateRequest` (sender/recipient/
 * paymentAndDocs/документы — зависит от запрошенного). Идёт через mcPassthroughPipe —
 * валидируем только наличие/тип обёртки, структуру MC проверяет сам.
 */
export class RfiUpdateRequestDto {
  @ApiProperty({
    description: 'Данные ответа на RFI (обёртка updateRequest).',
    example: {
      updateRequest: { sender: { firstName: 'John', lastName: 'Doe' } },
    },
  })
  @IsObject()
  updateRequest!: Record<string, unknown>;
}
