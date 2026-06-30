import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { QuoteRequestDto } from '../dto/quote-request.dto';
import { QuotesService } from '../services/quotes.service';

@Controller('xbs')
export class QuotesController {
  constructor(private readonly svc: QuotesService) {}

  @Post('quote')
  @HttpCode(200) // a quote is a computation, not a resource creation
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  quote(@Body() body: QuoteRequestDto) {
    return this.svc.quote(body);
  }
}
