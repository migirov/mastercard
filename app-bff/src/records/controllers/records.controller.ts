import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RecordsService } from '../services/records.service';

/**
 * Generic entity CRUD. The frontend client (`api.entities`) maps
 * `api.entities.<Name>.list/create/update/delete/get(...)` onto these routes.
 *
 * DELIBERATE DTO EXCEPTION (the one the team-lead rules carve out): the create/update
 * body is ARBITRARY entity JSON — the schema differs per entity type (Invoice vs.
 * VirtualCard vs. …) and is owned by the frontend, not us. So we accept it as a
 * passthrough `Record<string, unknown>` rather than a class-validator DTO. Strict
 * DTOs are still used for the XBS routes, where we own the contract.
 * (`filter` is intentionally not implemented — the frontend filters client-side.)
 */
@Controller('entities')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get(':name')
  list(
    @Param('name') name: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    return this.records.list(name, sort, limit ? Number(limit) : undefined);
  }

  @Get(':name/:id')
  get(@Param('name') name: string, @Param('id') id: string) {
    return this.records.get(name, id);
  }

  @Post(':name')
  create(@Param('name') name: string, @Body() body: Record<string, unknown>) {
    return this.records.create(name, body ?? {});
  }

  @Put(':name/:id')
  put(
    @Param('name') name: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.records.update(name, id, body ?? {});
  }

  @Patch(':name/:id')
  patch(
    @Param('name') name: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.records.update(name, id, body ?? {});
  }

  @Delete(':name/:id')
  remove(@Param('name') name: string, @Param('id') id: string) {
    return this.records.remove(name, id);
  }
}
