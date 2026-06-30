import { IsString } from 'class-validator';

/** Body of `POST /xbs/validate-account`. */
export class ValidateAccountDto {
  @IsString()
  iban!: string;
}
