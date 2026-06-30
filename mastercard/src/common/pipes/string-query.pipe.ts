import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates an OPTIONAL string filter query parameter (cash-pickup / endpoint-guide)
 * at the BOUNDARY. Unlike `SafeIdPipe` (for an id in the PATH), here the value goes
 * into the query string of the MC request and is URL-encoded (`qs()`), so special
 * characters/spaces are allowed (e.g. the city "New York"). The pipe's only job is to
 * reject a NON-string: with `?country[x]=1` / `?country=a&country=b` Express returns
 * an object/array, and without the pipe the filter would be SILENTLY dropped in `qs()`
 * (the client would think it had filtered but get a broader result set). Make the
 * contract explicit: non-string → 400. `undefined` (parameter not set) is fine.
 */
@Injectable()
export class StringQueryPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Query parameter must be a single string value',
      );
    }
    return value;
  }
}
