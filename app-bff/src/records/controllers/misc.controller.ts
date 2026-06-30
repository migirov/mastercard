import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvokeLlmDto } from '../dto/invoke-llm.dto';

// Per-route validation (no global pipe — the generic /entities CRUD is intentional passthrough
// and must NOT be whitelisted; team-lead issue #12). Strict: strips unknown keys + transforms.
const integrationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
});

/**
 * The remaining SDK surface the frontend uses, mocked for the demo:
 *  - `api.auth.me()`                       → a static demo user;
 *  - `api.integrations.Core.InvokeLLM`     → a canned assistant reply;
 *  - `api.integrations.Core.UploadFile`    → echoes a usable file_url (no real storage).
 */
@Controller()
export class MiscController {
  @Get('auth/me')
  me() {
    return {
      id: 'demo-user',
      full_name: 'Demo User',
      email: 'demo@xbs.local',
      role: 'admin',
    };
  }

  @Post('integrations/invoke-llm')
  @UsePipes(integrationPipe)
  invokeLlm(@Body() body: InvokeLlmDto) {
    // The pipe guarantees `prompt` is a string (or absent), so this is safe.
    const prompt = (body.prompt ?? '').slice(0, 200);
    return {
      response:
        'This is a demo assistant. Cross-border FX quotes and beneficiary ' +
        'validation are wired to the live Mastercard sandbox; payment submission ' +
        'and status are simulated until MTF/Prod access is enabled.' +
        (prompt ? `\n\n(You asked: "${prompt}")` : ''),
    };
  }

  @Post('integrations/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file?: { originalname?: string }) {
    const name = file?.originalname ?? 'document.pdf';
    // No real storage in the demo — return a stable, plausible URL.
    return {
      file_url: `https://demo.xbs.local/uploads/${encodeURIComponent(name)}`,
    };
  }
}
