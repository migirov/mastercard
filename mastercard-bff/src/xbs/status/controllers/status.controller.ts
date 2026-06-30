import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { StatusQueryDto } from '../dto/status-query.dto';
import { StatusService } from '../services/status.service';

@Controller('xbs')
export class StatusController {
  constructor(private readonly svc: StatusService) {}

  @Get('status')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  status(@Query() query: StatusQueryDto) {
    return this.svc.status(query.ref);
  }
}
