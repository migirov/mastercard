import { ApiProperty } from '@nestjs/swagger';

/**
 * Response of `POST /webhooks/mastercard/webhook` — the only gateway-authored webhook response
 * shape (the event itself is forwarded/processed, only the ack goes out).
 * `accepted` — the event was accepted for processing; `duplicate` — already seen (dedup).
 */
export class WebhookAckDto {
  @ApiProperty({ enum: ['accepted', 'duplicate'], example: 'accepted' })
  status!: 'accepted' | 'duplicate';
}
