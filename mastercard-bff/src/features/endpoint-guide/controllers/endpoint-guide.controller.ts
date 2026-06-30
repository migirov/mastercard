import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { EndpointGuideQueryDto } from '../dto/endpoint-guide-query.dto';
import { EndpointGuideService } from '../services/endpoint-guide.service';

@Controller('features')
export class EndpointGuideController {
  constructor(private readonly svc: EndpointGuideService) {}

  @Get('endpoint-guide')
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  guide(@Query() q: EndpointGuideQueryDto) {
    return this.svc.guide(q);
  }
}
