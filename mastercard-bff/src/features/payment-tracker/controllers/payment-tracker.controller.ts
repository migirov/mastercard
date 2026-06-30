import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { CancelPaymentDto } from '../dto/cancel-payment.dto';
import { TrackQueryDto } from '../dto/track-query.dto';
import { PaymentTrackerService } from '../services/payment-tracker.service';

@Controller('features/payment-tracker')
export class PaymentTrackerController {
  constructor(private readonly svc: PaymentTrackerService) {}

  @Get()
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  track(@Query() q: TrackQueryDto) {
    return this.svc.track(q.ref);
  }

  @Post('cancel')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  cancel(@Body() body: CancelPaymentDto) {
    return this.svc.cancel(body.id);
  }
}
