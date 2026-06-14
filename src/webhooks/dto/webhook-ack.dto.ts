import { ApiProperty } from '@nestjs/swagger';

/**
 * Ответ `POST /webhooks/mastercard` — единственная gateway-авторская форма ответа
 * вебхука (само событие пробрасывается/обрабатывается, наружу отдаём только ack).
 * `accepted` — событие принято к обработке; `duplicate` — уже виделось (дедуп).
 */
export class WebhookAckDto {
  @ApiProperty({ enum: ['accepted', 'duplicate'], example: 'accepted' })
  status!: 'accepted' | 'duplicate';
}
