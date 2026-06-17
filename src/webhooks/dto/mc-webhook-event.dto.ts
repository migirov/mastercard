import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Тело `POST /webhooks/mastercard`. Принимается с passthrough-pipe (whitelist:false),
 * т.к. MC присылает много полей сверх объявленных — их нельзя вырезать/отвергать.
 * Здесь типизируем и документируем известные поля для Swagger и обработчика.
 */
export class McWebhookEventDto {
  // eventRef/notificationId become the dedup key `tx_status.eventRef` (varchar 200),
  // so we cap the length to the column width.
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventRef?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notificationId?: string;

  // Длины ограничены и у НЕ-ключевых полей: тело вебхука пока не подписано (C1),
  // т.е. атакующий с токеном контролирует значения, а они попадают в логи —
  // без лимита это лог-инъекция/раздувание логов на ≤256kb. Бьём по длине.
  @ApiPropertyOptional({ example: 'STATUS_CHG', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventType?: string;

  // GENEROUS limit (256 — the `tx_status.transactionReference` width): enough to limit
  // log injection without rejecting a legitimately long MC ref (the body isn't signed →
  // a 400 = an MC retry).
  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  transactionReference?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  partnerId?: string;

  // MC присылает поля в ДВУХ нотациях в зависимости от типа уведомления:
  // Status Change — camelCase (выше), Carded Rate Push (CARDFX_PUB) и часть
  // событий — snake_case. Объявляем snake_case-варианты ключевых полей, чтобы
  // (а) дедуп/диспетчеризация в WebhookHandler работали для обеих нотаций;
  // (б) сохранить те же лимиты длины (защита от лог-инъекции — тело не подписано).
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  event_ref?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notification_id?: string;

  @ApiPropertyOptional({ example: 'CARDFX_PUB', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  event_type?: string;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  transaction_reference?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  partner_id?: string;
}
