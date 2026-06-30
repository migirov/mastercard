import { IsOptional, IsString } from 'class-validator';

/**
 * Body for `POST /features/rfi/requests/:requestId` — the sender's response to a
 * Request For Information. All fields optional (each RFI asks for a different subset);
 * the Strict pipe strips anything not declared here.
 */
export class RfiRespondDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
