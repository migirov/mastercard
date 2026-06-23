import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates an identifier from the path/query (`:id`, `:clientId`, `?ref=`) at the
 * BOUNDARY (controller), not by hand in the service. Identifiers are substituted into
 * the Mastercard request path, so they must not alter the URL structure: `/`, `\`,
 * whitespace, and `..` (path traversal) are forbidden. Empty is also an error (required).
 */
@Injectable()
export class SafeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    // Type-guard first: with `?ref[x]=1` / `?ref=a&ref=b` Express returns an object
    // or array — `.includes`/regex on a non-string would crash with a 500. Reject as 400.
    if (
      typeof value !== 'string' ||
      !value ||
      /[/\\\s]/.test(value) ||
      value.includes('..')
    ) {
      throw new BadRequestException('Invalid identifier');
    }
    return value;
  }
}
