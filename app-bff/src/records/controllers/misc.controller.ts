import {
  BadRequestException,
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
 * Accepted upload types, kept in step with the file input the UI actually offers:
 * `accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"` in RfiWorkflow.jsx. Narrowing this list further
 * would reject documents the form invites the user to pick — and that route swallows upload
 * errors, so the only symptom would be a Submit button that never enables.
 */
const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Minimal structural type — avoids pulling in @types/multer for one callback parameter. */
interface UploadedFileMeta {
  readonly mimetype: string;
  readonly originalname?: string;
}

/**
 * Bounded upload. multer defaults to memory storage and NO limits, so without this an
 * unauthenticated caller could stream arbitrary volume into the process heap. 5 MiB matches
 * nginx's `client_max_body_size 5m` on /demo-api/, so the two agree rather than one silently
 * shadowing the other.
 */
const uploadOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    parts: 12,
    fieldNameSize: 100,
    fieldSize: 100 * 1024,
  },
  fileFilter: (
    _req: unknown,
    file: UploadedFileMeta,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    if (ALLOWED_UPLOAD_MIME.has(file.mimetype)) return cb(null, true);
    cb(
      new BadRequestException(`unsupported file type: ${file.mimetype}`),
      false,
    );
  },
};

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
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadFile(@UploadedFile() file?: { originalname?: string }) {
    const name = file?.originalname ?? 'document.pdf';
    // No real storage in the demo — return a stable, plausible URL.
    return {
      file_url: `https://demo.xbs.local/uploads/${encodeURIComponent(name)}`,
    };
  }
}
