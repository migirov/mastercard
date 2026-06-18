import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Тело `POST /crossborder/rfi/documents` → MC RFI Upload Document API.
 * Загрузка файла (<1 MB), который потом линкуется к RFI-запросу. Обёртка
 * `uploadDocumentRequest` ({ fileName, file }), где `file` — содержимое в base64
 * (НЕ multipart; JSON). Ответ MC — { documentId }. Идёт через пресет Passthrough.
 */
export class RfiDocumentUploadRequestDto {
  @ApiProperty({
    description:
      'Документ (обёртка uploadDocumentRequest: { fileName, file }).',
    example: {
      uploadDocumentRequest: {
        fileName: 'Passport copy.pdf',
        file: '<base64-содержимое>',
      },
    },
  })
  @IsObject()
  uploadDocumentRequest!: Record<string, unknown>;
}
