import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { RatesQueryDto } from '../dto/rates-query.dto';
import { RatesService } from '../services/rates.service';

@Controller('features')
export class RatesController {
  constructor(private readonly svc: RatesService) {}

  /** FX / Carded Rates board (optionally narrowed to one `base`/`quote` pair). */
  @Get('rates')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  board(@Query() q: RatesQueryDto) {
    return this.svc.board(q);
  }
}
