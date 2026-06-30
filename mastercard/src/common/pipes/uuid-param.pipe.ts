import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates a UUID identifier from the path (RFI `request_id` / `document_id`), which
 * is substituted into the Mastercard request URL. MC requires a VALID RFC-4122 UUID and
 * otherwise responds `400 062000 INVALID_INPUT_FORMAT "Value contains invalid character"`
 * (Source: `request_id`) — established empirically, see docs/{ru,en}/api.md (RFI). We
 * check the format at the BOUNDARY (controller) to return a clean local 400 instead of a
 * round-trip to MC for an opaque error, and to save the outbound call.
 *
 * We accept any UUID version (1–5) with a correct variant nibble (8/9/a/b); we reject
 * "zero" version/variant nibbles (our former demo ids `33000000-…-000…0`,
 * `10000000-…-082000`) and non-hex. Stricter than `SafeIdPipe` (a valid UUID certainly
 * contains no `/`, `\`, whitespace, or `..`), so for UUID params it replaces it.
 *
 * Why NOT the built-in `ParseUUIDPipe` (verified empirically against @nestjs/common):
 *  • `new ParseUUIDPipe()` (mode `'all'`) uses its OWN weak regex without checking the
 *    version/variant nibbles → it LETS THROUGH `33000000-0000-0000-0000-000000000000`,
 *    and MC would return `062000` again — i.e. it doesn't solve the task (it is NOT a
 *    wrapper around `isUUID`);
 *  • `new ParseUUIDPipe({ version: '4' })` — conversely, rejects any valid NON-v4 UUID
 *    (v1/v3/v5), and we have no guarantee MC emits only v4.
 * So this is a regular custom `PipeTransform` (NestJS's sanctioned extension point) with
 * exact RFC-4122 (v1–5). Unit: `uuid-param.pipe.spec`.
 */
@Injectable()
export class UuidParamPipe implements PipeTransform<unknown, string> {
  // RFC-4122: 8-4-4-4-12 hex; version ∈ 1..5 (3rd group); variant ∈ {8,9,a,b} (4th group).
  private static readonly RFC4122 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  transform(value: unknown): string {
    // type-guard as in SafeIdPipe: `:id` is always a string, but a duplicate :param
    // or proxy case must not crash the pipe with a 500 — reject as 400.
    if (typeof value !== 'string' || !UuidParamPipe.RFC4122.test(value)) {
      throw new BadRequestException('Invalid UUID identifier');
    }
    return value;
  }
}
