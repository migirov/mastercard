import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { IbanGenerateDto } from '../dto/iban-generate.dto';
import { IbanService } from '../services/iban.service';

@Controller('features')
export class IbanController {
  constructor(private readonly svc: IbanService) {}

  @Post('iban')
  @HttpCode(200) // generates a value, not a resource in our system
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  generate(@Body() body: IbanGenerateDto) {
    return this.svc.generate(body);
  }
}
