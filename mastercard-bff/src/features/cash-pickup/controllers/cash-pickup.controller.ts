import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { CashPickupQueryDto } from '../dto/cash-pickup-query.dto';
import { CashPickupService } from '../services/cash-pickup.service';

@Controller('features/cash-pickup')
export class CashPickupController {
  constructor(private readonly svc: CashPickupService) {}

  @Get('countries')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  countries(@Query() q: CashPickupQueryDto) {
    return this.svc.list('countries', q);
  }

  @Get('cities')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  cities(@Query() q: CashPickupQueryDto) {
    return this.svc.list('cities', q);
  }

  @Get('providers')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  providers(@Query() q: CashPickupQueryDto) {
    return this.svc.list('providers', q);
  }

  @Get('branches')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  branches(@Query() q: CashPickupQueryDto) {
    return this.svc.list('branches', q);
  }
}
