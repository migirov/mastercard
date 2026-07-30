import { IsString, MaxLength } from 'class-validator';

/**
 * Body of `POST /gate/verify` — the password typed into the UI's access gate.
 *
 * `MaxLength` bounds the work done before hashing. The json body parser already caps the whole
 * body at express's 100 kb default (see the `bodyParser: false` note in main.ts), so this is
 * belt-and-braces rather than the only limit — but it keeps a 100 kb single-field body from
 * reaching sha256 at all, and it makes the accepted shape explicit.
 *
 * NOT `@IsOptional`: a missing password is a malformed request (400), not a failed attempt (401).
 * Distinguishing them keeps the 401 count meaningful — a client bug cannot masquerade as a
 * brute-force attempt in the logs.
 */
export class GateVerifyDto {
  @IsString()
  @MaxLength(256)
  password!: string;
}
