import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { ValidateAccountDto } from '../dto/validate-account.dto';
import { ValidateAddressDto } from '../dto/validate-address.dto';
import { ValidationsService } from '../services/validations.service';

@Controller('xbs')
export class ValidationsController {
  constructor(private readonly svc: ValidationsService) {}

  @Post('validate-account')
  @HttpCode(200) // a validation is a computation, not a resource creation
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  validateAccount(@Body() body: ValidateAccountDto) {
    return this.svc.validateAccount(body);
  }

  @Post('validate-address')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  validateAddress(@Body() body: ValidateAddressDto) {
    return this.svc.validateAddress(body);
  }
}
