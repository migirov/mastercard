import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body of `POST /crossborder/rfi/documents` → MC RFI Upload Document API.
 * Uploads a file (<1 MB) that is later linked to an RFI request.
 * `uploadDocumentRequest` wrapper ({ fileName, file }), where `file` is the
 * content in base64 (NOT multipart; JSON). MC's response is { documentId }.
 * Uses the Passthrough preset.
 */
export class RfiDocumentUploadRequestDto {
  @ApiProperty({
    description:
      'Document (uploadDocumentRequest wrapper: { fileName, file }).',
    example: {
      uploadDocumentRequest: {
        fileName: 'Passport copy.pdf',
        file: '<base64-content>',
      },
    },
  })
  @IsObject()
  uploadDocumentRequest!: Record<string, unknown>;
}
