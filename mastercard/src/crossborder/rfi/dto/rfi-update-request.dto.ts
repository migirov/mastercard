import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body of `POST /crossborder/rfi/requests/:requestId` → MC RFI Update Request API.
 * The Customer's response to an RFI request. `updateRequest` wrapper
 * (sender/recipient/paymentAndDocs/documents — depends on what was requested).
 * Uses the Passthrough preset — we only validate the presence/type of the
 * wrapper, MC checks the structure itself.
 */
export class RfiUpdateRequestDto {
  @ApiProperty({
    description: 'RFI response data (updateRequest wrapper).',
    example: {
      updateRequest: { sender: { firstName: 'John', lastName: 'Doe' } },
    },
  })
  @IsObject()
  updateRequest!: Record<string, unknown>;
}
