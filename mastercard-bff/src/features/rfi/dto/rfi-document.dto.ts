import { IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /features/rfi/documents` — a supporting document uploaded against an
 * RFI. `file` is the document encoded as a base64 string. The Strict pipe rejects any
 * extra fields.
 */
export class RfiDocumentDto {
  @IsString()
  @MaxLength(256)
  fileName!: string;

  // Sized to the route's 2 MB body-parser budget (AppModule.configure, issue #11): a base64
  // string just under 2 MB on the wire (~1.5 MB decoded), leaving headroom for the JSON
  // envelope + fileName. Capping in the DTO (DTO <= parser) gives a clean 400 with a clear
  // message instead of the parser's raw 413, and keeps the two gates consistent.
  @IsString()
  @MaxLength(2_096_000)
  file!: string;
}
