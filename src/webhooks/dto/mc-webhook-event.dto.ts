import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `POST /webhooks/mastercard`. Accepted with a passthrough pipe (whitelist:false),
 * because MC sends many fields beyond those declared — they must not be stripped or rejected.
 * Here we type and document the known fields for Swagger and the handler.
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

  // Lengths are bounded on non-key fields too: the webhook body is not yet signed (C1),
  // i.e. an attacker with a token controls the values, and they end up in logs —
  // without a limit this is log injection / log bloat up to ≤256kb. We cap by length.
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

  // MC sends fields in TWO notations depending on the notification type:
  // Status Change — camelCase (above), Carded Rate Push (CARDFX_PUB) and some
  // events — snake_case. We declare snake_case variants of the key fields so that
  // (a) dedup/dispatch in WebhookHandler work for both notations;
  // (b) the same length limits hold (log-injection guard — the body is not signed).
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
