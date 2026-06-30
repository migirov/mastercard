import { IsString, MinLength } from 'class-validator';

/**
 * Query for `GET /features/payment-tracker` — look up a payment's status/history by its
 * reference. The Strict pipe strips anything not declared here; `ref` is required.
 */
export class TrackQueryDto {
  @IsString()
  @MinLength(1)
  ref!: string;
}
