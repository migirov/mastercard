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

  @ApiPropertyOptional({ example: 'STATUS_CHG' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerId?: string;
}
