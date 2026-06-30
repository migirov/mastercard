import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import {
  demoValidationPipe,
  ValidationStrategy,
} from '../../../common/pipes/demo-validation.pipe';
import { RfiRespondDto } from '../dto/rfi-respond.dto';
import { RfiDocumentDto } from '../dto/rfi-document.dto';
import { RfiService } from '../services/rfi.service';

@Controller('features/rfi')
export class RfiController {
  constructor(private readonly svc: RfiService) {}

  @Get('requests/:requestId')
  retrieve(@Param('requestId') requestId: string) {
    return this.svc.retrieve(requestId);
  }

  @Post('requests/:requestId')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  respond(@Param('requestId') requestId: string, @Body() body: RfiRespondDto) {
    return this.svc.respond(requestId, body);
  }

  @Post('documents')
  @HttpCode(200)
  @UsePipes(demoValidationPipe(ValidationStrategy.Strict))
  upload(@Body() body: RfiDocumentDto) {
    return this.svc.uploadDocument(body);
  }
}
