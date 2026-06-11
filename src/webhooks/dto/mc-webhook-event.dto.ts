import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Тело `POST /webhooks/mastercard`. Принимается с passthrough-pipe (whitelist:false),
 * т.к. MC присылает много полей сверх объявленных — их нельзя вырезать/отвергать.
 * Здесь типизируем и документируем известные поля для Swagger и обработчика.
 */
export class McWebhookEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
