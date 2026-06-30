import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { PayRequestDto } from '../dto/pay-request.dto';
import { PaymentsService } from '../services/payments.service';

@Controller('xbs')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  // 201 (the POST default) is intentional: a /pay initiates (creates) a payment.
  @Post('pay')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  pay(@Body() body: PayRequestDto) {
    return this.svc.pay(body);
  }
}
