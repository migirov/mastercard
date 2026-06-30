import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { BankLookupDto } from '../dto/bank-lookup.dto';
import { BankLookupService } from '../services/bank-lookup.service';

@Controller('features')
export class BankLookupController {
  constructor(private readonly svc: BankLookupService) {}

  @Post('bank-lookup')
  @HttpCode(200) // a lookup is a computation, not a resource creation
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  lookup(@Body() body: BankLookupDto) {
    return this.svc.lookup(body);
  }
}
