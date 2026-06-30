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
import { ConfirmationDto } from '../dto/confirmation.dto';
import { RetrieveQuoteQueryDto } from '../dto/retrieve-quote-query.dto';
import { QuoteLifecycleService } from '../services/quote-lifecycle.service';

@Controller('features/quote-lifecycle')
export class QuoteLifecycleController {
  constructor(private readonly svc: QuoteLifecycleService) {}

  @Post('confirm')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  confirm(@Body() body: ConfirmationDto) {
    return this.svc.confirm(body);
  }

  @Post('cancel')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  cancel(@Body() body: ConfirmationDto) {
    return this.svc.cancel(body);
  }

  @Get('retrieve')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  retrieve(@Query() q: RetrieveQuoteQueryDto) {
    return this.svc.retrieve(q);
  }
}
