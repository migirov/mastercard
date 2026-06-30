import { IsString, MinLength } from 'class-validator';

/** Query of `GET /xbs/status?ref=<r>`. */
export class StatusQueryDto {
  @IsString()
  @MinLength(1)
  ref!: string;
}
