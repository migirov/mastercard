import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Тело `POST /webhooks/mastercard`. Принимается с passthrough-pipe (whitelist:false),
 * т.к. MC присылает много полей сверх объявленных — их нельзя вырезать/отвергать.
 * Здесь типизируем и документируем известные поля для Swagger и обработчика.
 */
export class McWebhookEventDto {
  // eventRef/notificationId становятся ключом kv_store (`wh:${ref}`, varchar 256),
  // поэтому ограничиваем длину — иначе длинный ref → ошибка БД (500) на дедупе.
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

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  partnerId?: string;
}
